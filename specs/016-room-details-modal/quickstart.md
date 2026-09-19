# Quickstart — Room Click Details Modal

## Prerequisites

- Reservation model fully deployed (all migrations + seed data applied)
- Development server running (`npm run dev`)
- Supabase local or project running

## Testing the API

### 1. Get room details

```bash
# Get a room ID from seed data
ROOM_ID=$(psql "$DB_URL" -t -c "SELECT id FROM public.rooms WHERE number = '101' LIMIT 1")

# Call the API
curl -s -H "Cookie: sb-access-token=$TOKEN" \
  "http://localhost:3000/api/rooms/$ROOM_ID/details-with-history?limit=50" | jq
```

### 2. Verify response shape

```bash
# Check room data
curl ... | jq '.room | { roomNumber, roomTypeName, physicalStatus }'

# Check current reservation
curl ... | jq '.currentReservation | { reservationNumber, guestName, status }'

# Check history count
curl ... | jq '.historyTotal'
```

## Testing the Modal UI

### 3. Open the modal from availability board

1. Navigate to the room availability view
2. Click any room card
3. Modal opens within 1 second

### 4. Verify modal displays correctly for each room state

Test these states:
- **Available room** (clean, no reservation) → shows availability card
- **Occupied room** (checked-in) → shows current reservation card
- **Dirty room** (recently checked out) → shows dirty status + last checkout
- **Maintenance room** → shows maintenance reason, booking blocked
- **Future booking** → shows next reservation card
- **Held room** → shows hold details + expiry time

### 5. Verify history table

1. Open modal for room 101 (has RSV-SEED-001 checked-in)
2. Scroll to history table
3. Verify events appear in reverse chronological order
4. Verify different event types (reservation.created, reservation.checked_in, etc.) are distinguishable

## Running E2E Tests

```bash
npm run test:e2e -- room-details-modal.spec.ts
```

## Acceptance Criteria Verification

1. Open `specs/016-room-details-modal/acceptance-checklist.md`
2. For each of the 26 criteria, run the verification step:
   - MCP queries for data integrity checks
   - API calls for service behavior checks
   - UI interactions for modal behavior checks
3. Mark each criterion [x] when verified
