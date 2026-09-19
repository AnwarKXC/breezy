---

description: "Task list for Reservation Lifecycle Services & Audit Logs"
---

# Tasks: Reservation Lifecycle Services & Audit Logs

**Input**: Design documents from `/specs/011-reservation-lifecycle-audit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Integration tests included for critical flows per Success Criteria requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `supabase/` at repository root
- Paths reflect the existing project structure documented in plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migrations and configuration updates

- [X] T001 Create Supabase migration for audit log indexes (`created_at` DESC, `module`+`action`) and hold expiry cleanup index (`expires_at`, `status`) in `supabase/migrations/YYYYMMDDHHMMSS_audit_retention_and_holds.sql`
- [X] T002 Update `DEFAULT_HOLD_DURATION_MINUTES` from 15 to 30 in `src/modules/reservations/constants.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Permission definitions and audit service enhancements that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add front-desk reservation lifecycle permission constants (`RESERVATION_CONFIRM`, `RESERVATION_CHECK_IN`, `RESERVATION_CHECK_OUT`, `RESERVATION_HOLD`, `RESERVATION_RECORD_PAYMENT`, `RESERVATION_NO_SHOW`, `RESERVATION_CHANGE_ROOM`, `RESERVATION_EXTEND_STAY`) to `ACTIONS` in `src/config/actionPermissions.ts`
- [X] T004 Add new permissions to `FRONT_DESK_ACTIONS` array in `src/config/actionPermissions.ts` and update `ROLE_PERMISSIONS` if needed
- [X] T005 Extend `mapToLogAction` in `src/modules/reservations/services/auditService.ts` to cover all missing event types (`reservation.held`, `reservation.confirmed`, `reservation.no_show`, `room.changed`, `room.assigned`, `room.released`, `price.calculated`, `price.overridden`, `payment.refunded`, `conflict.prevented`, `permission.denied`, `hold.created`, `hold.expired`, `hold.released`)
- [X] T006 Change `logReservationAction` in `src/modules/reservations/services/auditService.ts` to throw/re-throw errors instead of silently catching with `console.error` — audit failures MUST propagate to cause operation rollback

**Checkpoint**: Foundation ready — permission definitions and enhanced audit service available for all stories

---

## Phase 3: User Story 1 — Permission-Protected Lifecycle (Priority: P1) 🎯 MVP

**Goal**: All reservation lifecycle API routes check correct action permissions, hold revalidation is added to confirmation, and audit events are written for each lifecycle action. The front desk can walk through a complete lifecycle: create draft → hold → confirm → check-in → check-out, with each transition protected by the correct permission and recorded in the audit log.

**Independent Test**: Create a draft reservation for Room 101. Confirm it (requires `reservation:confirm`). Check in (requires `reservation:check_in`). Check out (requires `reservation:check_out`). Cancel (requires `reservation:cancel` — manager only). Verify each step records an audit event. Attempt each action without the correct permission and verify 403 error.

### Implementation for User Story 1

- [X] T007 [P] [US1] Update `POST /api/reservations/[id]/hold` route permission from `BOOKINGS_WRITE` to `RESERVATION_HOLD` in `src/app/api/reservations/[id]/hold/route.ts`
- [X] T008 [P] [US1] Update `POST /api/reservations/[id]/release-hold` route to add `RESERVATION_HOLD` permission check in `src/app/api/reservations/[id]/release-hold/route.ts`
- [X] T009 [P] [US1] Update `POST /api/reservations/[id]/confirm` route permission from `BOOKINGS_WRITE` to `RESERVATION_CONFIRM` in `src/app/api/reservations/[id]/confirm/route.ts`
- [X] T010 [P] [US1] Update `POST /api/reservations/[id]/check-in` route permission from `BOOKINGS_WRITE` to `RESERVATION_CHECK_IN` in `src/app/api/reservations/[id]/check-in/route.ts`
- [X] T011 [P] [US1] Update `POST /api/reservations/[id]/check-out` route permission from `BOOKINGS_WRITE` to `RESERVATION_CHECK_OUT` in `src/app/api/reservations/[id]/check-out/route.ts`
- [X] T012 [P] [US1] Update `POST /api/reservations/[id]/cancel` route to verify it uses `RESERVATION_CANCEL` (already set) in `src/app/api/reservations/[id]/cancel/route.ts`
- [X] T013 [US1] Add hold revalidation logic to `confirmReservation` service method in `src/modules/reservations/services/reservationService.ts` — before inserting rooms, check if all active holds for this reservation are still valid (not expired), and if any are expired, fail with a message indicating which room's hold expired
- [X] T014 [US1] Add audit event `reservation.created` to `POST /api/reservations` route handler in `src/app/api/reservations/route.ts` after successful draft creation
- [X] T015 [US1] Add audit logging to `POST /api/reservations/[id]/hold` and `POST /api/reservations/[id]/release-hold` routes (events `hold.created`, `hold.released`) in their respective route files

**Checkpoint**: At this point, User Story 1 should be fully functional — all lifecycle routes have correct permissions, confirmation revalidates holds, and audit events are written for each action.

---

## Phase 4: User Story 2 — Transactional Audit Trail (Priority: P2)

**Goal**: Every reservation lifecycle action writes a synchronous audit event. Audit failures cause operation rollback. The audit log is queryable with indexes and includes `permission.denied` events. Retention policy is enforced with archival and purge.

**Independent Test**: Perform a full lifecycle (create → confirm → check-in → check-out). Query the audit log — verify all event types are recorded with correct actor, timestamp, and metadata. Verify that if the audit log table was blocked (simulate failure), the operation rolls back. Create audit events over 12 months old and verify they are purged.

### Implementation for User Story 2

- [X] T016 [P] [US2] Add audit logging to record payment route (`payment.recorded`) in `src/app/api/reservations/[id]/payments/route.ts`
- [X] T017 [US2] Move audit log writes from route handlers into service methods for `confirmReservation`, `cancelReservation`, `checkInReservation`, `checkOutReservation`, `markNoShow` in `src/modules/reservations/services/reservationService.ts` so audit is part of the same service call
- [X] T018 [US2] Add `permission.denied` audit event logging — create a wrapper function that logs the denied action before throwing in `src/config/access.ts` or `src/shared/secureEndpoint.ts`
- [X] T019 [US2] Implement audit log event archival and purge logic — add a cleanup check (either as a scheduled Supabase cron job or inline during search queries) that archives and deletes events older than 12 months per FR-020

**Checkpoint**: At this point, User Story 2 should be fully functional — all events have complete audit trail, failures roll back, denied permissions are logged, and retention policy is enforced.

---

## Phase 5: User Story 3 — Hold Cleanup, Room Change, No-Show, Stay Extension (Priority: P3)

**Goal**: New lifecycle services for room changes, stay extensions, and no-show marking. Hold expiry cleanup runs inline during availability queries. Each new service has permission checks, validation, audit logging, and conflict detection.

**Independent Test**: Hold Room 101 → verify it blocks availability. Confirm with Room 101. Change room to Room 102 → verify Room 101 is released and Room 102 is blocked. Extend stay → verify dates update. Attempt extension with conflict → verify error with conflict details. Mark confirmed reservation as no-show after grace period → verify status changes to `no_show` and rooms release.

### Implementation for User Story 3

- [X] T020 [P] [US3] Add no-show grace period validation rule (`current time > scheduled checkout time + 2h default`) to `src/modules/reservations/validation.ts` — export a `validateNoShowGracePeriod(checkOutDate, gracePeriodMinutes?)` function
- [X] T021 [P] [US3] Implement `changeReservationRoom` service method in `src/modules/reservations/services/reservationService.ts` — validates target room availability, inserts new `reservation_rooms` row, releases old room, writes audit event
- [X] T022 [P] [US3] Implement `extendReservationStay` service method in `src/modules/reservations/services/reservationService.ts` — validates extension dates against conflicts, updates `check_out_date` and `nights` on both `reservations` and `reservation_rooms`, writes audit event
- [X] T023 [US3] Update `markNoShow` service method in `src/modules/reservations/services/reservationService.ts` to call `validateNoShowGracePeriod` before executing the status change
- [X] T024 [US3] Create `POST /api/reservations/[id]/no-show` route with `RESERVATION_NO_SHOW` permission in `src/app/api/reservations/[id]/no-show/route.ts`
- [X] T025 [US3] Create `POST /api/reservations/[id]/rooms` + `DELETE /api/reservations/[id]/rooms/[reservationRoomId]` routes with `RESERVATION_CHANGE_ROOM` permission in `src/app/api/reservations/[id]/rooms/route.ts`
- [X] T026 [US3] Create `POST /api/reservations/[id]/extend` route with `RESERVATION_EXTEND_STAY` permission in `src/app/api/reservations/[id]/extend/route.ts`
- [X] T027 [US3] Implement hold expiry inline cleanup in `getRoomAvailability` in `src/modules/reservations/services/availabilityService.ts` — before checking availability, expire any holds past their `expires_at` timestamp and record `hold.expired` audit events
- [X] T028 [US3] Export new service methods (`changeReservationRoom`, `extendReservationStay`) from `src/modules/reservations/services/index.ts`
- [X] T029 [US3] Add audit logging (`room.changed`, `room.released`, `reservation.no_show`, `hold.expired`) to all new service methods in their respective files

**Checkpoint**: At this point, User Story 3 should be fully functional — room changes, stay extensions, no-show, and hold cleanup all work with permissions, validation, audit logging, and conflict detection.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, testing, and final cleanup

- [X] T030 [P] Add integration tests for all status transitions per SC-002 — verify all 20 valid and invalid transitions in `tests/` (unit tests for `isValidTransition`)
- [X] T031 [P] Add integration test for concurrent double booking prevention per SC-003 — verify that two simultaneous confirmations for the same room result in exactly one success
- [X] T032 [P] Add integration test for audit event coverage per SC-004 — verify all 20+ event types are recorded at least once with correct actor and metadata
- [X] T033 [P] Add integration test for hold expiry per SC-005 — verify expired hold no longer blocks availability
- [X] T034 [P] Add integration test for room change and stay extension conflict detection per SC-006
- [X] T035 Run `pnpm lint` and fix any lint errors
- [X] T036 Run `pnpm build` and fix any build errors
- [X] T037 Run `quickstart.md` validation scenarios end-to-end
- [X] T038 [P] Update any documentation that references old `BOOKINGS_WRITE` permission for lifecycle actions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion — BLOCKS US2 and US3 (audit service enhancement needed first)
- **User Story 2 (Phase 4)**: Depends on Foundational completion — can be done in parallel with US1 for audit service work, but US1 must be complete before US2 integration testing
- **User Story 3 (Phase 5)**: Depends on Foundational completion — can proceed in parallel with US1/US2 for service methods, but shared files (reservationService.ts) need coordination
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — required permissions defined in T003-T004
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — audit service enhancements in T005-T006
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) — permission constants from T003-T004

### Within Each User Story

- Models/types before services (for new service methods)
- Services before API routes
- Audit logging integrated into each method as it's built
- API routes updated/created after service methods are ready

### Parallel Opportunities

- **Phase 2 Tasks T003-T004** (permissions) can run before T005-T006 (audit service) — they touch different files
- **Phase 3 Tasks T007-T012**: All [P] — each updates a different route file, can run in parallel
- **Phase 4 Tasks T016, T019**: [P] — different files
- **Phase 5 Tasks T020-T022**: [P] — validation.ts, new methods, can run in parallel
- **Phase 6 Tasks T030-T034**: All [P] — each test is independent
- **Intra-story parallelism**: Models/types updates, route file updates, and service method additions within each story are [P]-marked where they touch different files

---

## Parallel Example: User Story 1

```bash
# Launch all route permission updates together (different files):
Task: "T007 — Update hold route permission in hold/route.ts"
Task: "T008 — Update release-hold route permission in release-hold/route.ts"
Task: "T009 — Update confirm route permission in confirm/route.ts"
Task: "T010 — Update check-in route permission in check-in/route.ts"
Task: "T011 — Update check-out route permission in check-out/route.ts"
Task: "T012 — Verify cancel route permission in cancel/route.ts"

# Then after routes are updated:
Task: "T013 — Add hold revalidation to confirmReservation in reservationService.ts"
Task: "T014 — Add audit logging to create reservation route"
Task: "T015 — Add audit logging to hold/release-hold routes"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (permission-protected lifecycle)
4. **STOP and VALIDATE**: Test User Story 1 independently — verify each route checks the correct permission, confirmation revalidates holds, and audit events are written
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (permission-protected lifecycle) → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 (transactional audit trail) → Test independently → Deploy/Demo
4. Add User Story 3 (hold cleanup, room change, no-show, extension) → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: Phase 3 (US1 — route permission updates + hold revalidation)
   - Developer B: Phase 4 (US2 — audit trail enhancement + retention)
   - Developer C: Phase 5 (US3 — new services for room change, extension, no-show)
3. Stories complete and integrate independently
4. Team completes Phase 6 (Polish) together

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Phase 3 (US1) is the recommended MVP scope — permission-protected lifecycle with basic audit
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Total task count: 38 across all phases
