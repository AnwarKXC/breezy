# Data Model — Test Factories

## Overview

Test data is created via factory functions within each test file (simple in-line factories) or shared factory modules (cross-file reuse). All factories compose via existing service methods — they do not call the database or API directly.

## Shared Factory Module

### `src/modules/reservations/test/factories.ts`

```typescript
// Factory functions for reservation test data
// All factories create data via existing service methods, not direct DB access

export function createReservationInput(
  overrides: Partial<CreateReservationInput> = {}
): CreateReservationInput {
  return {
    bookingType: 'individual',
    checkInDate: '2026-07-15',
    checkOutDate: '2026-07-18',
    adults: 2,
    children: 0,
    roomCount: 1,
    billingParty: 'guest',
    ...overrides,
  }
}

export function roomInput(
  overrides: Partial<CreateRoomInput> = {}
): CreateRoomInput {
  return {
    roomNumber: '101',
    floor: 1,
    roomType: 'standard',
    basePrice: 15000,
    maxAdults: 2,
    maxChildren: 1,
    ...overrides,
  }
}

export function guestInput(
  overrides: Partial<CreateGuestInput> = {}
): CreateGuestInput {
  return {
    name: 'Test Guest',
    phone: '+1234567890',
    email: 'guest@test.com',
    idPassport: 'TP123456',
    ...overrides,
  }
}

export function companyInput(
  overrides: Partial<CreateCompanyInput> = {}
): CreateCompanyInput {
  return {
    name: 'Test Corp',
    contactPerson: 'John Doe',
    phone: '+1234567890',
    email: 'corp@test.com',
    creditLimit: 100000,
    paymentTerms: 30,
    contractSignedDate: '2026-01-01',
    ...overrides,
  }
}

export function discountInput(
  overrides: Partial<CreateDiscountInput> = {}
): CreateDiscountInput {
  return {
    type: 'percentage',
    value: 10,
    label: '10% discount',
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    ...overrides,
  }
}

export function priceOverrideInput(
  overrides: Partial<CreatePriceOverrideInput> = {}
): CreatePriceOverrideInput {
  return {
    price: 18000,
    effectiveDate: '2026-07-15',
    reason: 'Seasonal adjustment',
    ...overrides,
  }
}
```

## Test Data Shapes

### Deposit/Refund Flow Data

```typescript
export function depositInput(
  overrides: Partial<CreateDepositInput> = {}
): CreateDepositInput {
  return {
    amount: 5000,
    method: 'cash',
    notes: 'Deposit for reservation',
    ...overrides,
  }
}

export function refundInput(
  overrides: Partial<CreateRefundInput> = {}
): CreateRefundInput {
  return {
    amount: 5000,
    method: 'cash',
    reason: 'Cancellation refund',
    ...overrides,
  }
}
```

### Audit Trail Entries

```typescript
export function auditEntry(
  overrides: Partial<AuditEntry> = {}
): AuditEntry {
  return {
    id: 'audit-1',
    reservationId: 'res-1',
    action: 'reservation.created',
    performedBy: 'user-1',
    performedAt: '2026-06-28T10:00:00Z',
    details: { /* action-specific payload */ },
    previousState: null,
    newState: { status: 'hold' },
    ...overrides,
  }
}
```

## Coverage Matrix

| Test Category | Type | Factory Dependencies | What It Verifies |
|---|---|---|---|
| Date overlap | Unit | `createReservationInput` | Overlapping date ranges return conflict; non-overlapping pass |
| Status transitions | Unit | `createReservationInput` | Valid transitions succeed; invalid ones throw |
| Nights calculation | Unit | `createReservationInput` | Correct night count for same-year, cross-year, same-day |
| Pricing priority | Unit | `priceOverrideInput`, `discountInput` | Season override > base price; discount applied correctly |
| Company billing | Unit | `companyInput`, `createReservationInput` | Company rates, credit check, payment terms |
| Payment balance | Unit | `depositInput`, `refundInput` | Remaining balance, deposit tracking, refund math |
| Permission checks | Unit | `createReservationInput` | Each CRUD action enforces RBAC |
| Create reservation | Integration | `createReservationInput`, `guestInput`, `roomInput` | Full `createReservation` service method via mocked Supabase |
| Hold → Confirm | Integration | `createReservationInput` | Status transition hold→confirm with deposit |
| Double booking | Integration | `createReservationInput` | Same room, overlapping dates → conflict error |
| Cancel → Room release | Integration | `createReservationInput` | Cancellation marks room available again |
| Check-in/out | Integration | `createReservationInput` | Checked-in status, checked-out with billing |
| Audit + price override | Integration | `createReservationInput`, `priceOverrideInput` | Audit trail entries, price override logging |
| Same-day walk-in | E2E | API call sequence | Walk-in creates, prices, assigns room, checks in |
| Future reservation | E2E | API call sequence | Book future dates, confirm, cancel |
| Due-out dirty | E2E | API call sequence | Housekeeping status propagation |
| Maintenance block | E2E | API call sequence | Maintenance prevents booking |
| Company multi-room | E2E | API call sequence | Company reservation with multiple rooms |
| Split stay | E2E | API call sequence | Two reservations under one guest, no conflict |
| Room change | E2E | API call sequence | Change room assignment mid-stay |
| Stay extension conflict | E2E | API call sequence | Extension blocked by existing reservation |

## Factory Organization

- **Per-test factories**: Inline `vi.fn()` mocks and small factory functions within each test file
- **Shared factories**:`src/modules/reservations/test/factories.ts` for cross-file reuse
- **No static seeds**: All data is created per test and cleaned up after
- **Mocked services**:`vi.mock('@/services/supabase/server')` for all integration tests
