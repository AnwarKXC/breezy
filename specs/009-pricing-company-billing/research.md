# Research: Pricing and Company Billing

**Phase**: 0 — Architecture Decisions | **Date**: 2026-06-28

## Decisions

### D-001: Pricing Ladder Implementation

**Problem**: Six price sources with precedence must resolve to a single nightly rate.

**Options**:
- **Option A**: Long CASE/COALESCE chain in a single SQL query
- **Option B**: Application-layer resolution in TypeScript
- **Option C**: Materialized view with pre-resolved pricing

**Decision**: Option A — `COALESCE` chain in a `get_effective_rate()` SQL function.

**Rationale**: All sources live in PostgreSQL. A SQL function is transparent, testable, and avoids cache invalidation. Performance target (<3s) is easily met with indexed lookups. The function is:

```sql
get_effective_rate(
  p_room_id UUID,
  p_room_type_id UUID,
  p_night DATE,
  p_company_id UUID DEFAULT NULL
) RETURNS TABLE(rate NUMERIC, source TEXT, source_ref UUID)
```

Implementation:
1. Check `manual_override` for this room+night
2. Check `company_price_overrides` for this company+room_type
3. Check `seasonal_rates` for this room_type+date
4. Check `room_specific_rates` for this room+date
5. Fall back to `room_types.default_rate`

### D-002: Rate Capture at Confirmation

**Problem**: Post-confirmation pricing changes must not affect confirmed bookings (per clarify decision).

**Options**:
- **Option A**: Snapshot resolved rates into `reservation_pricing_items` at confirmation
- **Option B**: Recalculate from live tables on every read with a "frozen" flag

**Decision**: Option A — write resolved rates into `reservation_pricing_items` at confirmation.

**Rationale**: Simpler. The existing `create_reservation_pricing` function already writes pricing items. At confirmation, we add source_type/source_ref to each item. Post-confirmation, `reservation_pricing_items` is the authoritative source.

### D-003: Seasonal Rates Table Design

**Problem**: Seasonal rates need date ranges, room type association, and lifecycle management.

**Decision**: Single `seasonal_rates` table:

```sql
CREATE TABLE seasonal_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  room_type_id UUID NOT NULL REFERENCES room_types(id),
  override_rate NUMERIC(10,2) NOT NULL CHECK (override_rate >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Date ranges are half-open: `[start_date, end_date)` — end_date is exclusive. This means a season covering "March 1 to March 31" has `start_date = '2026-03-01'` and `end_date = '2026-04-01'`. A night is "in" a season when `night_date >= start_date AND night_date < end_date`.

### D-004: Room-Specific Rates Table Design

**Decision**: Single `room_specific_rates` table:

```sql
CREATE TABLE room_specific_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  override_rate NUMERIC(10,2) NOT NULL CHECK (override_rate >= 0),
  reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### D-005: Billing Type Enum

**Decision**: Enum `billing_type` values:

```sql
CREATE TYPE billing_type AS ENUM (
  'guest_pays',           -- All charges to guest (default)
  'company_room_only',    -- Room charges to company, incidentals to guest
  'company_all_charges',  -- All charges to company
  'split'                 -- Split by split_percentage (company / guest)
);
```

Column `reservations.billing_type` defaults to `'guest_pays'`. For non-company reservations, only `guest_pays` is valid. Column `reservations.split_percentage` is a NUMERIC(5,2) — the percentage the company pays (e.g., 50 = 50/50 split).

### D-006: Extension of `reservation_pricing_items`

**New columns**:
- `source_type TEXT NOT NULL CHECK (source_type IN ('default_rate', 'seasonal_rate', 'room_specific_rate', 'company_override', 'manual_override'))` — which source the rate came from
- `source_ref UUID` — FK to the source table record (nullable for default_rate which has no source row)
- `rate_per_night_at_booking NUMERIC(10,2)` — the resolved rate at the time of booking/confirmation (snapshot)

### D-007: Manual Override Audit Trail

**Decision**: Use a dedicated `price_override_audit_log` table rather than the generic audit log to keep the schema typed:

```sql
CREATE TABLE price_override_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  night_date DATE NOT NULL,
  old_rate NUMERIC(10,2) NOT NULL,
  new_rate NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  actor_id UUID NOT NULL,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('admin', 'front_desk')),
  threshold_checked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### D-008: Permission Enforcement

**Problem**: FR-008/FR-009 require different thresholds for admin vs front-desk.

**Decision**: Function `can_override_pricing(actor_id, new_rate, applicable_rate)` that:
- Returns `true` for admin users (unlimited)
- Returns `true` for front-desk users when `ABS(new_rate - applicable_rate) / applicable_rate <= threshold`
- Threshold fetched from a `pricing_config` table or constant (default ±10%)

This extends the `can_override_pricing()` helper referenced in assumptions.
