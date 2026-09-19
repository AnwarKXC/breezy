# Quickstart: Validation Scenarios

## Prerequisites

- Reservation types defined in `src/modules/reservations/types.ts`
- Reservation service at `src/modules/reservations/services/reservationService.ts`
- API routes at `src/app/api/reservations/`
- Supabase MCP access (or fallback: Supabase CLI + direct SQL)

---

## Scenario 1: Double Booking Prevention

**Objective**: Verify that two users cannot book the same room for overlapping dates.

### Steps

1. Using the reservation API, create a confirmed reservation for Room 101: check-in 2026-07-01, check-out 2026-07-03.
2. Attempt to create a second confirmed reservation for Room 101: check-in 2026-07-02, check-out 2026-07-04.
3. Verify the second attempt fails with a conflict error.

### Expected Outcome

- First reservation succeeds.
- Second reservation fails with error code `ROOM_NOT_AVAILABLE` or `CONFLICT`.
- Room 101 shows `availabilityStatus: "booked"` or `"occupied_now"` for the overlapping dates.

### Validation Query (Supabase CLI / SQL)

```sql
SELECT room_id, check_in_date, check_out_date, status
FROM reservation_rooms
WHERE status IN ('held', 'reserved', 'occupied')
AND room_id = '101-uuid'
ORDER BY check_in_date;
```

---

## Scenario 2: Status Transition Validation

**Objective**: Verify that only valid status transitions are allowed.

### Steps

1. Create a draft reservation.
2. Attempt to check in the draft reservation (should fail).
3. Confirm the draft reservation.
4. Check in the confirmed reservation (should succeed).
5. Attempt to confirm the checked-in reservation (should fail).

### Expected Outcome

| Transition | Valid? |
|-----------|--------|
| draft → checked_in | ❌ |
| draft → confirmed | ✅ |
| confirmed → checked_in | ✅ |
| checked_in → confirmed | ❌ |

### Code Reference

```typescript
import { isValidTransition } from 'src/modules/reservations/types';

isValidTransition('draft', 'confirmed');  // true
isValidTransition('draft', 'checked_in'); // false
```

---

## Scenario 3: Price Override Audit Trail

**Objective**: Verify that manual price overrides are audited with old price, new price, reason, and actor.

### Steps

1. Create a confirmed reservation with a standard rate (e.g., $200/night).
2. Apply a price override to $150/night with reason "VIP corporate rate".
3. Verify the pricing item records `price_source = 'manual_override'`, `manual_override_reason`, and `manual_override_by`.
4. Verify an audit log entry is created with old price, new price, reason, and actor.

### Expected Outcome

- Reservation pricing reflects $150/night.
- `reservation_pricing_items` has a row with `price_source = 'manual_override'`.
- `audit_logs` has an entry for `price.overridden` with full metadata.

---

## Scenario 4: Hold Expiry and Room Release

**Objective**: Verify that holds block availability while active and release after expiry.

### Steps

1. Create a hold on Room 101: check-in 2026-07-01, check-out 2026-07-03, 30-minute duration.
2. Check availability for Room 101 on those dates — should show as held/blocked.
3. Simulate expiry (either via cron or by manually setting `expires_at` to past).
4. Check availability again — Room 101 should now appear available.

### Expected Outcome

- Active hold: Room 101 unavailable for the held dates.
- Expired hold: Room 101 available again.
- Hold status changes from `active` to `expired`.

### Validation Query

```sql
SELECT room_id, check_in_date, check_out_date, expires_at, status
FROM reservation_holds
WHERE status = 'active'
AND expires_at > now();
```

---

## Scenario 5: Company Billing Party Assignment

**Objective**: Verify company reservations correctly assign billing to the company.

### Steps

1. Create a company reservation for 3 rooms over 2 nights.
2. Assign different guest names to each room.
3. Verify the billing party is set to `company`.
4. Verify the company rate override is applied to pricing.

### Expected Outcome

- Reservation `billing_party = 'company'`.
- Company rate override reflected in pricing (different from default room rate).
- Each room has a `reservation_guest` assigned.
- Audit log records the company rate application.

---

## Scenario 6: MCP Inspection Workflow Test

**Objective**: Verify that the MCP database inspection workflow produces a complete findings document.

### Steps

1. Run the MCP inspection checklist (see [contracts/mcp-inspection.md](./contracts/mcp-inspection.md)).
2. Answer the 11 questions by inspecting the database.
3. Produce the findings document in the defined output format.

### Expected Outcome

- All tables listed with their current state.
- Clear extend/create decision for each table.
- Migration count estimated.
- Total inspection time under 30 minutes (per SC-002).
