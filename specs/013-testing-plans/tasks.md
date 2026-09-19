---

description: "Task list for testing plans — reservation model unit, integration, and E2E test suites"
---

# Tasks: Testing Plans for Reservation Model

**Input**: Design documents from `/specs/013-testing-plans/`

**Prerequisites**: plan.md, spec.md (3 user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: The entire feature IS tests — every task is a test file implementation. No separate test tasks needed.

**Organization**: Tasks are grouped by test type (unit → integration → E2E) mapping to user stories for independent execution.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1=unit, US2=integration, US3=E2E)
- Include exact file paths in descriptions

## Path Conventions

- **Unit tests**: Co-located with source: `src/modules/reservations/` (existing project convention from research)
- **Integration tests**: Under `src/modules/reservations/services/__tests__/` with `.integration.test.ts` suffix
- **E2E tests**: Under `e2e/reservations/` with `.spec.ts` suffix (existing Playwright convention)
- **Test infrastructure**: `src/modules/reservations/test/`

---

## Phase 1: Setup (Shared Test Infrastructure)

**Purpose**: Create test factory module, helpers, and directory structure that all three test suites depend on

- [x] T001 Create shared test factory module at `src/modules/reservations/test/factories.ts` with `createReservationInput`, `roomInput`, `guestInput`, `companyInput`, `discountInput`, `priceOverrideInput`, `depositInput`, `refundInput`, `auditEntry` factory functions per data-model.md
- [x] T002 [P] Create integration test helpers at `src/modules/reservations/test/helpers.ts` with mock setup boilerplate (Supabase mock chaining, auth session mock, RBAC mock) and reusable `createThenableQuery` wrappers per research.md patterns
- [x] T003 [P] Create E2E test helpers at `e2e/helpers/reservations.ts` with typed API client methods (`createReservation`, `getReservation`, `updateReservation`, `deleteReservation`, `getAuditLog`, `createPayment`, `getPayments`) and auth token setup per research.md Playwright pattern

---

## Phase 2: User Story 1 — Core Logic Unit Tests (Priority: P1) 🎯 MVP

**Goal**: 7 unit test files covering date overlap, status transitions, nights calculation, pricing priority, company billing, payment balance, and permission checks — all in isolation with no database dependencies.

**Independent Test**: `npx vitest run` — all unit tests pass in under 10 seconds with no server or database required.

### Implementation for User Story 1

- [x] T004 [P] [US1] Write date overlap detection + nights calculation tests in `src/modules/reservations/validation.test.ts` covering FR-001, FR-003: overlapping/non-overlapping/adjacent date ranges, same-year/cross-year/same-day night counts, see data-model.md coverage matrix
- [x] T005 [P] [US1] Write status transition validation tests in `src/modules/reservations/services/statusService.test.ts` covering FR-002: all valid transitions (hold→confirmed, confirmed→checked_in, checked_in→checked_out, etc.) and all invalid transitions (checked_out→confirmed, cancelled→checked_in, etc.)
- [x] T006 [P] [US1] Write pricing priority resolution tests in `src/modules/reservations/services/pricingService.test.ts` covering FR-004: manual override > company rate > seasonal rate > room-type base price, discount stacking, edge cases
- [x] T007 [P] [US1] Write company billing + payment balance tests at `src/modules/reservations/services/__tests__/billing.test.ts` covering FR-005: company credit limit checks, payment terms, billing party resolution; FR-006: total - paid = remaining balance, deposit tracking, refund math
- [x] T008 [P] [US1] Write permission check tests at `src/modules/reservations/services/__tests__/security.test.ts` covering FR-007: each CRUD action enforces RBAC, unauthorized actions return/permit correctly

**Checkpoint**: All 5 unit test files passing — core business logic fully validated without external dependencies.

---

## Phase 3: User Story 2 — Integration Tests for Reservation Flows (Priority: P2)

**Goal**: 6 integration test files verifying complete reservation flows with mocked Supabase — create, hold→confirm, double booking prevention, cancel→release, check-in/out, audit log + price override.

**Independent Test**: `npx vitest run reservations --reporter=verbose` — all integration tests pass against mocked Supabase services.

### Implementation for User Story 2

- [x] T009 [P] [US2] Write create reservation integration test at `src/modules/reservations/services/__tests__/create-reservation.integration.test.ts` covering FR-008: individual booking, company booking, multi-room booking, input validation errors, duplicate prevention
- [x] T010 [P] [US2] Write hold → confirm flow integration test at `src/modules/reservations/services/__tests__/hold-confirm.integration.test.ts` covering FR-009: hold reservation, confirm with deposit, hold expiry handling, confirm failure on expired hold
- [x] T011 [P] [US2] Write double booking prevention integration test at `src/modules/reservations/services/__tests__/double-booking.integration.test.ts` covering FR-010: same room overlapping dates → conflict, adjacent dates allowed, same room different dates allowed
- [x] T012 [P] [US2] Write cancel releases room integration test at `src/modules/reservations/services/__tests__/cancel-releases-room.integration.test.ts` covering FR-011: cancel confirmed reservation, verify room availability restored, cancel already-cancelled (idempotent)
- [x] T013 [P] [US2] Write check-in/out integration test at `src/modules/reservations/services/__tests__/check-in-out.integration.test.ts` covering FR-012: check-in confirmed reservation, check-out with billing verification, invalid transition attempts
- [x] T014 [P] [US2] Write audit log + price override integration test at `src/modules/reservations/services/__tests__/audit-price-override.integration.test.ts` covering FR-013: manual price override writes audit entry, price override reflects in billing, audit trail for status changes

**Checkpoint**: All 6 integration test files passing — service-layer flows verified end-to-end.

---

## Phase 4: User Story 3 — End-to-End Front Desk Scenarios (Priority: P3)

**Goal**: 8 E2E spec files simulating real front desk workflows through the complete API — walk-in booking, future reservation, due-out dirty, maintenance block, company multi-room, split-stay, room change, stay extension conflict.

**Independent Test**: `npm run test:e2e` — all 8 reservation scenarios pass against a running server.

### Implementation for User Story 3

- [x] T015 [P] [US3] Write same-day walk-in booking E2E spec at `e2e/reservations/same-day-walk-in.spec.ts` covering FR-014: create reservation → confirm → check in → room marked occupied, full happy path workflow
- [x] T016 [P] [US3] Write future reservation + conflict E2E spec at `e2e/reservations/future-reservation.spec.ts` covering FR-015: book future dates for occupied room, confirm, cancel, conflict detection for overlapping future booking
- [x] T017 [P] [US3] Write due-out dirty room E2E spec at `e2e/reservations/due-out-dirty.spec.ts` covering FR-016: check-out → room status dirty → housekeeping → room available again
- [x] T018 [P] [US3] Write maintenance room block E2E spec at `e2e/reservations/maintenance-room.spec.ts` covering FR-017: set room to maintenance → booking attempt rejected → restore → booking allowed
- [x] T019 [P] [US3] Write company multi-room booking E2E spec at `e2e/reservations/company-multi-room.spec.ts` covering FR-018: company creates reservation for multiple rooms, pending guest names, company as billing party
- [x] T020 [P] [US3] Write split-stay reservation E2E spec at `e2e/reservations/split-stay.spec.ts` covering FR-019: guest stays in room A, switches to room B for remaining nights, no date overlap, both reservations under same guest
- [x] T021 [P] [US3] Write room change mid-stay E2E spec at `e2e/reservations/room-change.spec.ts` covering FR-020: change room assignment during active stay, old room released, new room assigned, audit trail
- [x] T022 [P] [US3] Write stay extension conflict E2E spec at `e2e/reservations/stay-extension-conflict.spec.ts` covering FR-021: extend stay into dates blocked by existing reservation → conflict error, extension to available dates succeeds

**Checkpoint**: All 8 E2E spec files passing — complete front desk workflow coverage.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Coverage configuration, full suite validation, quickstart verification

- [x] T023 Add Vitest coverage configuration to `vitest.config.ts` enabling `v8` provider, covering `src/modules/reservations/` with 80% threshold
- [x] T024 Run full test suite (`npm test` + `npm run test:e2e:e2e -- --grep reservations`) and validate quickstart.md commands produce expected output
- [x] T025 Remove any console.log statements from test helpers, verify no `as any` or `@ts-ignore` in test code per constitution strictness rules

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Unit Tests (Phase 2 / US1)**: Depends on T001 (factories) — BLOCKS nothing else
- **Integration Tests (Phase 3 / US2)**: Depends on T001-T002 (factories + helpers)
- **E2E Scenarios (Phase 4 / US3)**: Depends on T003 (E2E helpers), plus all API endpoints from prior phases
- **Polish (Phase 5)**: Depends on completion of all desired phases

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories — fully independent
- **US2 (P2)**: No dependencies on US1 — fully independent (different test patterns)
- **US3 (P3)**: No dependencies on US1 or US2 — fully independent (different framework, E2E vs unit)

**All three user stories can be executed in parallel with no shared state.**

### Within Each Phase

- Phase 2 (US1): All 5 tasks are fully parallel (`[P]` on every task)
- Phase 3 (US2): All 6 tasks are fully parallel (`[P]` on every task)
- Phase 4 (US3): All 8 tasks are fully parallel (`[P]` on every task)

### Parallel Opportunities

- Phase 1 T001-T003: T002 and T003 can run in parallel after T001
- Phase 2 (US1): All 5 test files fully parallel (different files, no shared deps)
- Phase 3 (US2): All 6 test files fully parallel
- Phase 4 (US3): All 8 test files fully parallel
- Phase 3 and Phase 4 can run in parallel with Phase 2 (no cross-dependencies)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 unit tests in parallel (independent files):
Task: "Write date overlap + nights calc tests in validation.test.ts"
Task: "Write status transition tests in statusService.test.ts"
Task: "Write pricing priority tests in pricingService.test.ts"
Task: "Write billing + payment balance tests in billing.test.ts"
Task: "Write permission check tests in security.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: T001 (factories) — 1 task
2. Complete Phase 2 (US1): T004-T008 — 5 tasks in parallel
3. **STOP and VALIDATE**: `npx vitest run` — all unit tests pass <10s
4. MVP delivered: Core business logic fully tested

### Incremental Delivery

1. Phase 1 + Phase 2 → Unit test coverage (MVP!)
2. Phase 3 → Integration test coverage
3. Phase 4 → E2E coverage
4. Each phase adds coverage depth without breaking previous phases

### Parallel Team Strategy

With multiple developers:

1. Developer A (Setup): T001-T003 — Test infrastructure (1-2 tasks)
2. All 3 phases can be assigned to different developers after T001 completes:
   - Developer B: Phase 2 (US1) — All 5 unit tests in parallel
   - Developer C: Phase 3 (US2) — All 6 integration tests in parallel
   - Developer D: Phase 4 (US3) — All 8 E2E specs in parallel
3. No merge conflicts: all test files are independent

---

## Notes

- [P] tasks = different files, no dependencies — can be executed simultaneously
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable (no cross-dependencies)
- Tests use existing Vitest + Playwright configuration — no new framework installs
- Factories from T001 are shared across US1, US2, and US3
- E2E tests require a running server with test database
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
