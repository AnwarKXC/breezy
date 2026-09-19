# Research: Testing Plans for Reservation Model

## Existing Test Infrastructure

### Vitest Configuration

**Decision**: Use existing Vitest v4.0.14 configuration — co-located tests in `src/**/*.test.{ts,tsx}`

**Rationale**: The project already has Vitest configured with happy-dom, path aliases (`@/`), and `server-only` mocking. Adding new test files for the reservations module should follow the same pattern.

**Alternatives considered**: Creating a separate `tests/` directory — rejected because it deviates from the established project convention.

### Test Location

**Decision**: Co-locate tests next to source files following existing patterns

**Rationale**: 
- Unit tests: `src/modules/reservations/validation.test.ts`, `src/modules/reservations/services/reservationService.test.ts`
- API route tests: `src/app/api/reservations/route.test.ts`, `src/app/api/reservations/[id]/route.test.ts`
- This matches the existing pattern used for contacts, accounting, etc.

**Alternatives considered**: Separate `tests/` directory — rejected to maintain consistency.

### Existing Mock Infrastructure

**Decision**: Reuse `createThenableQuery` pattern and module mocking approach

**Rationale**: The project already has:
- `src/services/supabase/__mocks__/server.ts` — mock query builder
- `src/services/supabase/__mocks__/admin.ts` — mock admin query builder
- Auth mocking via `@/services/auth/serverSession` and `@/config/rbac`

**Key patterns**:
```ts
vi.mock('@/services/supabase/server')
vi.mock('@/services/supabase/admin')
vi.mock('@/services/auth/serverSession')
vi.mock('@/config/rbac')

// Mock factory function for test data
function contactRow(overrides = {}) { return { id: '1', ...defaults, ...overrides } }

// Set up default session
vi.mocked(getCurrentServerSession).mockResolvedValue({ id: 'user1', email: 'admin@test.com', role: 'admin' })
vi.mocked(canPerformAction).mockReturnValue(true)
```

### Existing Reservation Tests

**Decision**: No existing tests — this is a greenfield testing effort for the entire reservation module

**Rationale**: No test files exist anywhere in `src/modules/reservations/` or `src/app/api/reservations/`. All test files must be created from scratch.

### Existing NPM Scripts

- `npm test` → `vitest run --pool=threads` (run all unit/frontend tests)
- `npm run test:e2e` → `playwright test` (run E2E tests)
- No coverage configuration currently exists

**Decision**: No new npm scripts needed for unit/integration tests (existing `npm test` picks up all `*.test.*` files). E2E tests should be added to the existing `e2e/` Playwright setup.

### Auth Testing Pattern

**Decision**: Mock `getCurrentServerSession` for unit/integration tests; use real auth tokens for E2E

**Rationale**: Unit and integration tests should not depend on real auth infrastructure. E2E tests need real sessions to validate the full auth flow.

## Test Data Approach

### Factory Functions

**Decision**: Create factory functions in `src/modules/reservations/test/factories.ts`

**Rationale**: The spec clarified factory functions via service method calls. Following the existing pattern from contacts tests (`contactRow()` factory), create composable factory functions for reservations, rooms, guests, holds, and payments.

**Example pattern**:
```ts
function createReservationInput(overrides: Partial<CreateReservationInput> = {}): CreateReservationInput {
  return {
    bookingType: 'individual',
    checkInDate: '2026-07-15',
    checkOutDate: '2026-07-18',
    adults: 1,
    children: 0,
    roomCount: 1,
    billingParty: 'guest',
    ...overrides,
  }
}
```

## E2E Testing

### Approach

**Decision**: Add E2E tests to the existing `e2e/` Playwright setup as new spec files

**Rationale**: Playwright is already configured and used for E2E tests in the project. Adding reservation E2E scenarios follows the established pattern.
