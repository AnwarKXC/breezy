# Contract: Check-In

**Route**: `POST /api/reservations/[id]/check-in`

**Permission**: `reservation:check_in`

Transitions `confirmed` → `checked_in`. Updates room physical status.

### Request Body

```json
{
  "roomAssignments": [
    {
      "roomId": "uuid",
      "guestId": "uuid",
      "documentType": "passport",
      "documentNumber": "AB123456"
    }
  ]
}
```

### Response (200)

```json
{
  "data": {
    "id": "uuid",
    "status": "checked_in",
    "checkedInAt": "2026-07-01T14:00:00Z",
    "rooms": [
      {
        "roomId": "uuid",
        "roomNumber": "101",
        "guestName": "John Doe",
        "status": "occupied"
      }
    ]
  },
  "error": null
}
```
