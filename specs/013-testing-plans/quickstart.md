# Quickstart — Testing Plans

## Running Tests

```bash
# Run all unit + integration tests (uses existing vitest config)
npm test

# Run tests matching a pattern
npx vitest run reservations          # All reservation tests
npx vitest run date-overlap           # Date overlap tests only
npx vitest run e2e/reservations       # Reservation E2E tests

# Run in watch mode during development
npx vitest reservations

# Run E2E tests
npm run test:e2e
```

## Writing Tests

### Unit Test (service function)

```typescript
import { describe, it, expect } from 'vitest'
import { canOverlap } from './reservationValidation'

describe('canOverlap', () => {
  it('returns false when dates overlap', () => {
    expect(canOverlap(
      { checkIn: '2026-07-15', checkOut: '2026-07-18' },
      { checkIn: '2026-07-16', checkOut: '2026-07-20' }
    )).toBe(false)
  })

  it('returns true when dates are adjacent', () => {
    expect(canOverlap(
      { checkIn: '2026-07-15', checkOut: '2026-07-18' },
      { checkIn: '2026-07-18', checkOut: '2026-07-20' }
    )).toBe(true)
  })
})
```

### Integration Test (service with mocked Supabase)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReservation } from './reservationService'

vi.mock('@/services/supabase/server')
vi.mock('@/services/supabase/admin')
vi.mock('@/config/rbac')
vi.mock('@/services/auth/serverSession')

import { mockQuery } from '@/services/supabase/server'

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.result = { data: null, count: 0, error: null }
})

describe('createReservation', () => {
  it('creates a reservation successfully', async () => {
    // Arrange mocks for room lookup, availability check, insert
    // Act
    const result = await createReservation(input, user)
    // Assert
    expect(result.status).toBe('hold')
    expect(result.bookingType).toBe('individual')
  })
})
```

## Test Patterns

| Pattern | When to Use | Example |
|---|---|---|
| Pure function test | Stateless logic | `canOverlap()`, `calculateNights()`, `canTransition()` |
| Service mock test | Stateful business logic | `createReservation()`, `cancelReservation()` |
| API route test | Endpoint contract | `GET /api/reservations`, `POST /api/reservations` |
| E2E scenario | Full workflow | Walk-in → price → assign → check-in |

## Adding a New Test

1. Create test file next to source: `src/modules/reservations/<file>.test.ts`
2. Import pure functions directly for unit tests
3. Mock Supabase + auth for integration tests
4. Run `npm test` to verify

## Key Constraints

- No `as any` or `@ts-ignore` in test code
- Each test creates and cleans up its own data (no shared state)
- Integration tests mock Supabase, not real database
- E2E tests use real API + test database
- Tests are excluded from production build (Vitest convention)
