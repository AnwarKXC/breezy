# RPC Contracts: Pricing and Company Billing

**Phase**: 1 — Contract Design | **Date**: 2026-06-28

## RPC-001: `get_pricing_breakdown`

Returns itemized pricing breakdown for a reservation.

```sql
CREATE OR REPLACE FUNCTION get_pricing_breakdown(
  p_reservation_id UUID
) RETURNS TABLE(
  room_id UUID,
  room_name TEXT,
  night_date DATE,
  rate NUMERIC(10,2),
  source_type TEXT,          -- 'default_rate' | 'seasonal_rate' | 'room_specific_rate' | 'company_override' | 'manual_override'
  source_ref UUID,           -- nullable — NULL for default_rate
  source_label TEXT,         -- human-readable: e.g., "Summer 2026", "Acme Corp override", "Manual override: compensation"
  currency TEXT,
  subtotal_room NUMERIC,     -- room total across all nights
  billing_type billing_type,
  company_name TEXT,         -- nullable (when billing_type is not guest_pays)
  company_share NUMERIC,     -- amount company pays
  guest_share NUMERIC        -- amount guest pays
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

**Permission**: Authenticated user with `front_desk`, `admin`, or `accountant` role (via existing `get_session()` check).

**Description**: For each room-night in the reservation, resolves the rate through the pricing ladder (manual > company > seasonal > room-specific > default). If reservation is confirmed, reads from `reservation_pricing_items` (snapshot). If draft, computes live from source tables. Returns billing distribution based on `billing_type`.

---

## RPC-002: `apply_manual_override`

Applies a manual price override for a specific room and date range.

```sql
CREATE OR REPLACE FUNCTION apply_manual_override(
  p_reservation_id UUID,
  p_room_id UUID,
  p_night_date DATE,
  p_new_rate NUMERIC(10,2),
  p_reason TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

**Permission**: Authenticated user with `front_desk` or `admin` role.

**Description**:
1. Calls `can_override_pricing(p_actor_id, p_new_rate, applicable_rate)` to check permission
2. Records old rate by calling `get_effective_rate(p_room_id, p_room_type_id, p_night_date, p_company_id)`
3. Inserts into `price_override_audit_log` with old_rate, new_rate, reason, actor_id, permission_level
4. If reservation is draft: inserts/replaces a placeholder row in `reservation_pricing_items` with `source_type = 'manual_override'` and `source_ref = audit_log.id`
5. If reservation is confirmed: inserts a new override row in `reservation_pricing_items` with `source_type = 'manual_override'` and `source_ref = audit_log.id` (appended, not replaced — preserves original snapshot)
6. Returns JSONB: `{ success: true, audit_log_id, old_rate, new_rate }`

**Error cases**:
- Reservation not found → 404
- Room not part of reservation → 400
- New rate exceeds threshold and user is front_desk → 403
- Negative rate → 400 (zero is allowed for complimentary bookings)
- Empty reason → 400

---

## RPC-003: `manage_billing_type`

Sets or changes the billing arrangement on a reservation.

```sql
CREATE OR REPLACE FUNCTION manage_billing_type(
  p_reservation_id UUID,
  p_billing_type billing_type,
  p_split_percentage NUMERIC(5,2) DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

**Permission**: Authenticated user with `front_desk` or `admin` role.

**Description**:
1. Validates billing_type is compatible with reservation's company_id:
   - `guest_pays` is always valid
   - `company_room_only`, `company_all_charges`, `split` require a company on the reservation
2. If billing_type = 'split', requires `split_percentage` (1-99)
3. Updates `reservations.billing_type` and `reservations.split_percentage`
4. If reservation is draft, triggers pricing recalculation
5. Writes audit log entry: "Billing type changed from <old> to <new>"
6. Returns JSONB: `{ success: true, old_billing_type, new_billing_type, old_split_percentage, new_split_percentage }`

**Error cases**:
- Reservation not found → 404
- billing_type requires company but reservation has none → 400
- split_percentage NULL when billing_type = 'split' → 400
- split_percentage not in 1-99 range → 400
- Not authorized → 403

---

## Helper: `get_effective_rate`

Internal function — resolves the pricing ladder for a single room-night.

```sql
CREATE OR REPLACE FUNCTION get_effective_rate(
  p_room_id UUID,
  p_room_type_id UUID,
  p_night DATE,
  p_company_id UUID DEFAULT NULL
) RETURNS TABLE(
  rate NUMERIC(10,2),
  source_type TEXT,
  source_ref UUID,
  source_label TEXT
) LANGUAGE plpgsql STABLE SET search_path = public
```

**Permission**: No access check — called by other RPCs (SECURITY DEFINER chain).

---

## Helper: `can_override_pricing`

Internal function — checks if actor is allowed to override a rate.

```sql
CREATE OR REPLACE FUNCTION can_override_pricing(
  p_actor_id UUID,
  p_new_rate NUMERIC(10,2),
  p_applicable_rate NUMERIC(10,2)
) RETURNS TABLE(
  allowed BOOLEAN,
  permission_level TEXT,
  reason TEXT
) LANGUAGE plpgsql STABLE SET search_path = public
```
