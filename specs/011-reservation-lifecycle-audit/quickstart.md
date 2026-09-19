# Quickstart: Reservation Lifecycle Services & Audit Logs

## Prerequisites

- Node 20+, pnpm installed
- Supabase local or remote project running
- Database migrations from phases 001–010 applied
- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

## Setup

```bash
# Install dependencies
pnpm install

# Apply new migration (audit indexes + hold cleanup)
pnpm db:migrate

# Regenerate TypeScript types
pnpm db:types

# Run linter
pnpm lint
```

## Validation Scenarios

### Scenario 1: Permission-Protected Lifecycle

```bash
# Create a draft reservation
curl -X POST /api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "bookingType": "individual",
    "checkInDate": "2026-07-10",
    "checkOutDate": "2026-07-13",
    "adults": 1,
    "billingParty": "guest",
    "primaryGuestId": "<guest-uuid>"
  }'
# Expected: 201 with reservation data (audit event reservation.created written)

# Confirm (should fail for front desk without permission)
curl -X POST /api/reservations/<id>/confirm \
  -H "Content-Type: application/json" \
  -d '{"selectedRooms": [...], "pricingAccepted": true}'
# Expected: Uses RESERVATION_CONFIRM permission
```

### Scenario 2: Full Lifecycle Flow

```bash
# 1. Create draft
# 2. Hold room
curl -X POST /api/reservations/<id>/hold \
  -H "Content-Type: application/json" \
  -d '{"roomId": "<room-uuid>", "checkInDate": "2026-07-10", "checkOutDate": "2026-07-13"}'
# Expected: 201, hold.created audit event

# 3. Confirm
curl -X POST /api/reservations/<id>/confirm \
  -H "Content-Type: application/json" \
  -d '{"selectedRooms": [{"roomId": "<room-uuid>", "roomTypeId": "<type-uuid>", "checkInDate": "2026-07-10", "checkOutDate": "2026-07-13"}], "pricingAccepted": true}'
# Expected: 200, reservation.confirmed audit event

# 4. Check in
curl -X POST /api/reservations/<id>/check-in
# Expected: 200, reservation.checked_in audit event

# 5. Check out
curl -X POST /api/reservations/<id>/check-out
# Expected: 200, reservation.checked_out audit event
```

### Scenario 3: No-Show

```bash
# Create confirmed reservation with checkout at 2026-07-10 12:00
# Attempt mark no-show immediately
curl -X POST /api/reservations/<id>/no-show \
  -H "Content-Type: application/json" \
  -d '{"reason": "Guest did not arrive"}'
# Expected: 400 — grace period not yet elapsed

# Wait 2+ hours past checkout time
# Retry
curl -X POST /api/reservations/<id>/no-show
# Expected: 200, reservation.no_show audit event, rooms released
```

### Scenario 4: Room Change

```bash
# Create confirmed reservation with Room 101
# Change to Room 102
curl -X DELETE /api/reservations/<id>/rooms/<room101-id>
curl -X POST /api/reservations/<id>/rooms \
  -H "Content-Type: application/json" \
  -d '{"roomId": "<room102-uuid>", "roomTypeId": "<type-uuid>", "checkInDate": "2026-07-10", "checkOutDate": "2026-07-13", "adults": 1}'
# Expected: room.changed audit event, Room 101 released, Room 102 assigned
```

### Scenario 5: Stay Extension with Conflict

```bash
# Checkout is July 13
# Try extending to July 15 when Room 101 is already booked July 14-16
curl -X POST /api/reservations/<id>/extend \
  -H "Content-Type: application/json" \
  -d '{"newCheckOutDate": "2026-07-15"}'
# Expected: 400 with conflict details (reservation RSV-1012 blocks July 14-16)

# Try extending to July 14 (no conflict)
curl -X POST /api/reservations/<id>/extend \
  -H "Content-Type: application/json" \
  -d '{"newCheckOutDate": "2026-07-14"}'
# Expected: 200, updated checkout date, audit event written
```

### Scenario 6: Concurrent Double Booking Prevention

```bash
# Run in two terminals simultaneously
# Terminal 1: POST /api/reservations/<id>/confirm with Room 101
# Terminal 2: POST /api/reservations/<id2>/confirm with Room 101 (same dates)
# Expected: Exactly one succeeds, one fails with conflict error
```

### Scenario 7: Audit Log Visibility

```bash
# After running scenarios 1-5:
# Check audit log query
GET /api/reservations/<id> — verify reservation data
# Expected: Each lifecycle action has a corresponding audit event
```

## Verification

```bash
# Run existing tests
pnpm test -- --run

# Run specific tests for this feature
pnpm test -- specs/011-reservation-lifecycle-audit/

# Run linter
pnpm lint

# Build
pnpm build
```

## Expected Results

| Scenario | Expected Pass Rate | Notes |
|----------|-------------------|-------|
| Permission-protected lifecycle | 100% | All API routes check correct permissions |
| Full lifecycle flow | 100% | Draft → hold → confirm → check-in → check-out |
| No-show with grace period | 100% | Follows 2h default, configurable |
| Room change | 100% | Releases old room, assigns new, audit trail |
| Stay extension | 100% | Conflict-aware, updates dates |
| Concurrent double booking | 100% | Exactly one succeeds |
| Audit trail completeness | 100% | All ~20 event types recorded |
