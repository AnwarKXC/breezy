# Quickstart: Validation Scenarios

## 1. Status Transitions

```typescript
const transitionMap: Record<string, string[]> = {
  draft: ['held', 'confirmed', 'cancelled'],
  held: ['confirmed', 'expired', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
  no_show: [],
  expired: [],
};

function validateStatusTransition(
  fromStatus: string,
  toStatus: string,
): boolean {
  return transitionMap[fromStatus]?.includes(toStatus) ?? false;
}
```

### Test Scenarios

| From | To | Valid |
|------|----|-------|
| draft | held | ✅ |
| draft | confirmed | ✅ |
| draft | cancelled | ✅ |
| held | confirmed | ✅ |
| held | expired | ✅ |
| confirmed | checked_in | ✅ |
| confirmed | cancelled | ✅ |
| checked_in | checked_out | ✅ |
| draft | checked_in | ❌ |
| cancelled | confirmed | ❌ |
| checked_out | checked_in | ❌ |

---

## 2. Double Booking Prevention

```typescript
// Exclusion constraint guarantees no overlap
constraint reservation_rooms_no_overlap
  exclude using gist (
    room_id with =,
    daterange(check_in_date, check_out_date, '[)') with &&
  )
  where (status = any(array['held', 'reserved', 'occupied']))
```

### Test Scenarios

| Room | Check-in | Check-out | Overlap |
|------|----------|-----------|---------|
| 101 | 2026-07-01 | 2026-07-03 | — |
| 101 | 2026-07-02 | 2026-07-05 | ✅ overlap |
| 101 | 2026-07-03 | 2026-07-05 | ❌ (check-out = check-in, `'[)'` excludes end) |
| 102 | 2026-07-01 | 2026-07-03 | ❌ different room |

---

## 3. Pricing Priority Resolution

```typescript
const PRICE_SOURCE_PRIORITY = [
  'manual_override',
  'company_override',
  'seasonal_rate',
  'room_specific_rate',
  'default_room_type_rate',
] as const;

function resolveEffectiveRate(
  sources: Record<string, number>,
): { rate: number; source: string } {
  for (const source of PRICE_SOURCE_PRIORITY) {
    if (sources[source] != null) {
      return { rate: sources[source], source };
    }
  }
  throw new Error('No price source available');
}
```

### Test Scenarios

| Default | Room Rate | Seasonal | Company | Manual | Result |
|---------|-----------|----------|---------|--------|--------|
| 200 | 180 | null | null | null | 180 (room_specific_rate) |
| 200 | null | 250 | null | null | 250 (seasonal_rate) |
| 200 | 180 | 250 | null | null | 250 (seasonal > room) |
| 200 | 180 | 250 | 150 | null | 150 (company_override) |
| 200 | 180 | 250 | 150 | 100 | 100 (manual_override) |

---

## 4. Hold Expiry

```typescript
const HOLD_DURATION_MINUTES = 30;

function isHoldExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date();
}
```

### Test Scenarios

| Created | Expires | Checked At | Expired? |
|---------|---------|------------|----------|
| 10:00 | 10:30 | 10:15 | ❌ |
| 10:00 | 10:30 | 10:30 | ✅ (at boundary) |
| 10:00 | 10:30 | 10:45 | ✅ |

---

## 5. Payment/Balance Consistency

```typescript
const invariants = [
  { check: 'total_amount >= 0' },
  { check: 'paid_amount >= 0' },
  { check: 'balance_amount = total_amount - paid_amount' },
  { check: 'paid_amount <= total_amount', label: 'Overpayment not allowed' },
];

function validatePaymentInvariants(reservation: Reservation): string[] {
  const errors: string[] = [];
  const balance = reservation.totalAmount - reservation.paidAmount;
  if (balance !== reservation.balanceAmount) {
    errors.push('Balance mismatch');
  }
  if (reservation.paidAmount > reservation.totalAmount) {
    errors.push('Overpayment not allowed');
  }
  return errors;
}
```
