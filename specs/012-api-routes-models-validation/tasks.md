# Tasks: API Routes, TypeScript Models, and Validation

**Input**: Design documents from `/specs/012-api-routes-models-validation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-contracts.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment verification and pattern confirmation

- [X] T001 Review existing reservation route handlers in `src/app/api/reservations/` and confirm current implementation state for each endpoint
- [X] T002 [P] Review existing permission actions in `src/config/actionPermissions.ts` and map which reservation lifecycle actions already exist vs need creation
- [X] T003 [P] Review existing validation functions in `src/modules/reservations/validation.ts` and confirm interfaces (ValidationError, function signatures)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Permission actions, validation functions, and error format utility — must complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add 10 new reservation lifecycle actions to `ACTIONS` in `src/config/actionPermissions.ts`: RESERVATION_CONFIRM, RESERVATION_CHECK_IN, RESERVATION_CHECK_OUT, RESERVATION_NO_SHOW, RESERVATION_HOLD, RESERVATION_CHANGE_ROOM, RESERVATION_EXTEND, RESERVATION_MANAGE_GUESTS, RESERVATION_RECORD_PAYMENT, RESERVATION_DELETE_ROOM
- [X] T005 [P] Assign new actions to FRONT_DESK role in `src/config/actionPermissions.ts` (all except RESERVATION_DELETE_ROOM which is admin-only)
- [X] T006 [P] Add new validation functions in `src/modules/reservations/validation.ts`: `validateAddRoom`, `validateChangeRoom`, `validateAddGuest`, `validateMarkNoShow`, `validateExtendStay`, `validateHoldCreation`, `validatePaymentRecording`
- [X] T007 [P] Create error format utility function `formatValidationErrors(errors: ValidationError[]): { errors: Array<{ path, message, code }> }` in `src/modules/reservations/validation.ts` or a shared location
- [X] T008 [P] Add missing validation constants and helper functions if needed (e.g., room status check helpers, date comparison utilities) in `src/modules/reservations/validation.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Reservation API Endpoints (Priority: P1) 🎯 MVP

**Goal**: A front desk user can perform all core reservation lifecycle operations through secure API endpoints

**Independent Test**: Call each lifecycle endpoint (create → hold → confirm → check-in → check-out → cancel/no-show) with valid inputs and confirm correct status transitions and audit log entries

### Implementation for User Story 1

- [X] T009 [P] [US1] Implement POST create reservation draft route in `src/app/api/reservations/route.ts` using existing `createReservationDraft` service
- [X] T010 [P] [US1] Implement GET list reservations route in `src/app/api/reservations/route.ts` with cursor-based pagination and filters (status, date range, guest name, booking type, company)
- [X] T011 [P] [US1] Implement GET reservation by ID route in `src/app/api/reservations/[id]/route.ts` with full details (rooms, guests, payments, companyInfo, notes, statusHistory)
- [X] T012 [P] [US1] Implement PATCH update reservation draft route in `src/app/api/reservations/[id]/route.ts` using existing `updateReservationDraft` service
- [X] T013 [P] [US1] Implement POST hold rooms route in `src/app/api/reservations/[id]/hold/route.ts` using existing `createHold` service with permission check for RESERVATION_HOLD
- [X] T014 [P] [US1] Implement POST release hold route in `src/app/api/reservations/[id]/release-hold/route.ts` using existing `releaseHold` service with permission check for RESERVATION_HOLD
- [X] T015 [P] [US1] Implement POST confirm reservation route in `src/app/api/reservations/[id]/confirm/route.ts` with idempotency check using existing `confirmReservation` service and RESERVATION_CONFIRM permission
- [X] T016 [P] [US1] Implement POST check-in route in `src/app/api/reservations/[id]/check-in/route.ts` with idempotency check using existing `checkInReservation` service and RESERVATION_CHECK_IN permission
- [X] T017 [P] [US1] Implement POST check-out route in `src/app/api/reservations/[id]/check-out/route.ts` with idempotency check using existing `checkOutReservation` service and RESERVATION_CHECK_OUT permission
- [X] T018 [P] [US1] Implement POST cancel route in `src/app/api/reservations/[id]/cancel/route.ts` with idempotency check using existing `cancelReservation` service and RESERVATION_CANCEL permission
- [X] T019 [P] [US1] Implement POST no-show route in `src/app/api/reservations/[id]/no-show/route.ts` with idempotency check using existing `markNoShow` service and RESERVATION_NO_SHOW permission
- [X] T020 [US1] Add audit logging calls to all US1 route handlers using `logReservationAction(session, AuditInput)` after each successful mutation
- [X] T021 [US1] Add validation error handling to all US1 route handlers — convert `ValidationError[]` to structured `{ errors: [{ path, message, code }] }` responses

**Checkpoint**: At this point, User Story 1 should be fully functional — full reservation lifecycle can be completed via API

---

## Phase 4: User Story 2 — Room and Guest Operations through API (Priority: P2)

**Goal**: A front desk user can manage room assignments, guests, payments, and retrieve room details with history through dedicated API endpoints

**Independent Test**: Perform a room change during a checked-in stay, add a guest, record a payment, and verify room history — all through API calls with correct updates and audit trail

### Implementation for User Story 2

- [X] T022 [P] [US2] Implement POST add room route in `src/app/api/reservations/[id]/rooms/route.ts` using existing `addReservationRoom` service
- [X] T023 [P] [US2] Implement PATCH update room route in `src/app/api/reservations/[id]/rooms/[reservationRoomId]/route.ts` for room change (new room assignment) using RESERVATION_CHANGE_ROOM permission
- [X] T024 [P] [US2] Implement DELETE remove room route in `src/app/api/reservations/[id]/rooms/[reservationRoomId]/route.ts` using existing `removeReservationRoom` service with RESERVATION_DELETE_ROOM permission (admin-only)
- [X] T025 [P] [US2] Implement POST add guest route in `src/app/api/reservations/[id]/guests/route.ts` using existing `addReservationGuest` service with RESERVATION_MANAGE_GUESTS permission
- [X] T026 [P] [US2] Implement PATCH update guest route in `src/app/api/reservations/[id]/guests/[reservationGuestId]/route.ts` with RESERVATION_MANAGE_GUESTS permission
- [X] T027 [P] [US2] Implement POST record payment route in `src/app/api/reservations/[id]/payments/route.ts` using existing `recordPayment` service with RESERVATION_RECORD_PAYMENT permission
- [X] T028 [P] [US2] Implement GET room details with history route in `src/app/api/rooms/[id]/details-with-history/route.ts` returning RoomDetailsWithHistory shape
- [X] T029 [P] [US2] Implement GET room history route in `src/app/api/rooms/[id]/history/route.ts` returning RoomHistoryRow[]
- [X] T030 [US2] Add audit logging calls to all US2 mutation route handlers using `logReservationAction(session, AuditInput)`
- [X] T031 [US2] Add validation error handling to all US2 route handlers — convert `ValidationError[]` to structured error responses

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T032 [P] Verify all route handlers in `src/app/api/reservations/` and `src/app/api/rooms/` use consistent `{ data }` wrapper response format
- [X] T033 [P] Verify all route handlers return consistent error format — structured `{ errors: [...] }` for validation, `{ error: "code" }` for business errors
- [X] T034 [P] Run `pnpm lint` and fix any ESLint issues in new/modified files
- [ ] T035 [P] Run quickstart.md validation scenarios against the running server
- [X] T036 Run `pnpm build` and confirm it succeeds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-4)**: All depend on Foundational phase completion
  - US1 and US2 can proceed in parallel if staffed
  - Or sequentially in priority order (US1 → US2)
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Requires Foundation (Phase 2) — No dependencies on US2
- **User Story 2 (P2)**: Requires Foundation (Phase 2) — independently testable from US1

### Within Each User Story

- Services already exist — route handlers are the primary deliverable
- Individual routes within a story can be implemented in any order (marked [P])
- Audit logging (T020, T030) integrate into all routes in that story
- All routes use the same `secureEndpoint` wrapper pattern

### Parallel Opportunities

- All Phase 2 tasks marked [P] — permissions, validation, error format utility
- All Phase 3 tasks marked [P] — each route is a separate file, fully independent
- All Phase 4 tasks marked [P] — rooms, guests, payments, room history are independent files
- Phase 3 and Phase 4 can run in parallel (different route files)

---

## Parallel Example: User Story 1

```bash
# Launch all route handlers in parallel (each is a separate file):
Task: "POST create in src/app/api/reservations/route.ts"
Task: "GET list in src/app/api/reservations/route.ts"
Task: "GET by id in src/app/api/reservations/[id]/route.ts"
Task: "POST hold in src/app/api/reservations/[id]/hold/route.ts"
Task: "POST release-hold in src/app/api/reservations/[id]/release-hold/route.ts"
Task: "POST confirm in src/app/api/reservations/[id]/confirm/route.ts"
Task: "POST check-in in src/app/api/reservations/[id]/check-in/route.ts"
Task: "POST check-out in src/app/api/reservations/[id]/check-out/route.ts"
Task: "POST cancel in src/app/api/reservations/[id]/cancel/route.ts"
Task: "POST no-show in src/app/api/reservations/[id]/no-show/route.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup — review existing code
2. Complete Phase 2: Foundational — permissions, validation, error format
3. Complete Phase 3: User Story 1 — all lifecycle endpoints
4. **STOP and VALIDATE**: Run quickstart.md scenarios 1-7
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 (MVP — lifecycle API) → Test → Deploy
3. Add User Story 2 (rooms, guests, payments, history) → Test → Deploy
4. Polish → Lint, build, final verification

### Parallel Team Strategy

With multiple developers:

1. Complete Setup + Foundational together
2. Once Foundation is done:
   - Developer A: User Story 1 lifecycle endpoints
   - Developer B: User Story 2 room+guest+payment+history endpoints
3. Polish tasks can be split between developers

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- All route handlers follow the same `secureReadEndpoint` / `secureMutationEndpoint` pattern from research.md
- Existing service methods are reused — no new service logic needed
- Existing types are reused — no new type definitions needed
- Existing audit service is reused — just add `logReservationAction` calls
- Stop at any checkpoint to validate the story independently
