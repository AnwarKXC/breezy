# Contract: Payments

**Route**: `POST /api/reservations/[id]/payments`

**Permission**: `reservation:record_payment`

### Request Body

```json
{
  "paymentType": "deposit",
  "method": "card",
  "amount": 100.00,
  "currency": "USD",
  "transactionReference": "TXN-123456",
  "paidBy": "guest",
  "notes": "Booking deposit"
}
```

### Response (201)

```json
{
  "data": {
    "id": "uuid",
    "reservationId": "uuid",
    "paymentType": "deposit",
    "method": "card",
    "amount": 100.00,
    "status": "paid",
    "receiptNumber": "RCPT-001",
    "createdAt": "2026-06-28T10:00:00Z"
  },
  "error": null
}
```

### Idempotency

Use `transactionReference` to prevent duplicate payment recording.
