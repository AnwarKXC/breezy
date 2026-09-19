# Quickstart: Validation Scenarios for API Routes

## Prerequisites

- All existing reservation database tables exist (from prior phases)
- Server running at `http://localhost:3000`
- Test user with `front_desk` role and session token
- Test user with `admin` role for manager-only operations
- Sample rooms, room types, and guest records exist in the database

## Setup

```bash
# Start dev server
pnpm dev

# Get session token (see auth docs)
# Store as TOKEN for subsequent requests
```

## Scenario 1: Full Lifecycle (Happy Path)

Tests the complete reservation lifecycle through API endpoints.

```bash
# 1. Create draft
RESPONSE=$(curl -s -X POST http://localhost:3000/api/reservations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingType": "individual",
    "checkInDate": "2026-07-15",
    "checkOutDate": "2026-07-18",
    "adults": 1,
    "roomCount": 1,
    "billingParty": "guest"
  }')
DRAFT_ID=$(echo $RESPONSE | jq -r '.data.id')
echo "Draft created: $DRAFT_ID"

# 2. Hold a room
HOLD_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/reservations/$DRAFT_ID/hold" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roomIds": ["<room-uuid>"],
    "checkInDate": "2026-07-15",
    "checkOutDate": "2026-07-18"
  }')
HOLD_ID=$(echo $HOLD_RESPONSE | jq -r '.data.holdId')
echo "Hold created: $HOLD_ID"

# 3. Confirm reservation
CONFIRM_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/reservations/$DRAFT_ID/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"reservationId\": \"$DRAFT_ID\",
    \"selectedRooms\": [{
      \"roomId\": \"<room-uuid>\",
      \"roomTypeId\": \"<room-type-uuid>\",
      \"checkInDate\": \"2026-07-15\",
      \"checkOutDate\": \"2026-07-18\"
    }],
    \"pricingAccepted\": true,
    \"acknowledgedWarnings\": []
  }")
echo "Confirmed: $(echo $CONFIRM_RESPONSE | jq -r '.data.status')"

# 4. Check in
CHECKIN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/reservations/$DRAFT_ID/check-in" \
  -H "Authorization: Bearer $TOKEN")
echo "Check-in: $(echo $CHECKIN_RESPONSE | jq -r '.data.status')"

# 5. Check out
CHECKOUT_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/reservations/$DRAFT_ID/check-out" \
  -H "Authorization: Bearer $TOKEN")
echo "Check-out: $(echo $CHECKOUT_RESPONSE | jq -r '.data.status')"
```

**Expected**: Each step returns HTTP 200/201 with correct status transition.

## Scenario 2: Validation Errors

Tests that invalid inputs are rejected with structured error format.

```bash
# Create with check-out before check-in
curl -s -X POST http://localhost:3000/api/reservations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingType": "individual",
    "checkInDate": "2026-07-18",
    "checkOutDate": "2026-07-15",
    "adults": 1,
    "roomCount": 1,
    "billingParty": "guest"
  }'
```

**Expected**: HTTP 400 with `{ "errors": [{ "path": "checkOutDate", "message": "...", "code": "invalid_date_range" }] }`

## Scenario 3: Permission Denied

Tests that endpoints enforce permissions.

```bash
# Front desk user attempts cancel (manager-only)
curl -s -X POST "http://localhost:3000/api/reservations/<id>/cancel" \
  -H "Authorization: Bearer $FRONT_DESK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected**: HTTP 403 (null body, per `authorizeRequest` pattern)

## Scenario 4: Unauthenticated Request

Tests that public requests are rejected.

```bash
curl -s -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"bookingType":"individual","checkInDate":"2026-07-15","checkOutDate":"2026-07-18","adults":1,"roomCount":1,"billingParty":"guest"}'
```

**Expected**: HTTP 401 (null body)

## Scenario 5: Idempotent Confirm

Tests that confirming an already-confirmed reservation succeeds.

```bash
# Confirm once
curl -s -X POST "http://localhost:3000/api/reservations/<id>/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reservationId":"<id>","selectedRooms":[...],"pricingAccepted":true,"acknowledgedWarnings":[]}'

# Confirm again — should succeed
curl -s -X POST "http://localhost:3000/api/reservations/<id>/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reservationId":"<id>","selectedRooms":[...],"pricingAccepted":true,"acknowledgedWarnings":[]}'
```

**Expected**: Second call returns HTTP 200 (same as first), not 409.

## Scenario 6: Concurrent Conflict Prevention

Tests that concurrent confirmations for overlapping rooms are prevented. Use two terminals:

```bash
# Terminal 1: Confirm reservation A with room X for dates 2026-07-15 to 2026-07-18
curl -s -X POST "http://localhost:3000/api/reservations/<id-A>/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'

# Terminal 2 (at same time): Try to confirm reservation B with room X for overlapping dates
curl -s -X POST "http://localhost:3000/api/reservations/<id-B>/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**Expected**: One succeeds (200), the other returns HTTP 409 with `{ "error": "reservations/room_unavailable", "conflicts": [...] }`.

## Scenario 7: Rate Limiting

Tests that the rate limiter responds with 429.

```bash
# Send 31+ mutation requests rapidly
for i in $(seq 1 35); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:3000/api/reservations/<id>/check-in" \
    -H "Authorization: Bearer $TOKEN"
done
```

**Expected**: After 30 mutation requests, subsequent calls return HTTP 429 with `{ "error": "auth/rate_limited" }` and `Retry-After` header.

## Scenario 8: Room Details with History

Tests the room details endpoint.

```bash
curl -s "http://localhost:3000/api/rooms/<room-id>/details-with-history?from=2026-01-01&to=2026-12-31&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected**: HTTP 200 with `room`, `currentReservation?`, `nextReservation?`, `availability`, and `history[]` fields.

## Scenario 9: Room Change

Tests changing a room assignment during stay.

```bash
curl -s -X PATCH "http://localhost:3000/api/reservations/<id>/rooms/<reservationRoomId>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roomId": "<new-room-uuid>"}'
```

**Expected**: HTTP 200 with updated `ReservationRoom` data. Old room is released, new room is assigned.

## Scenario overview

| # | Scenario | Endpoints Tested | Expected Result |
|---|----------|-----------------|-----------------|
| 1 | Full lifecycle | create, hold, confirm, check-in, check-out | All 200/201 |
| 2 | Validation errors | create | 400 with structured errors |
| 3 | Permission denied | cancel (front desk) | 403 |
| 4 | Unauthenticated | create | 401 |
| 5 | Idempotent confirm | confirm x2 | Both 200 |
| 6 | Concurrent conflict | confirm (overlapping) | One 200, one 409 |
| 7 | Rate limiting | check-in x35 | Eventually 429 |
| 8 | Room details | details-with-history | 200 with full shape |
| 9 | Room change | rooms PATCH | 200 with updated room |
