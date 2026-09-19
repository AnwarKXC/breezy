---

description: "Task list for Reservation Creation and Hold Flow — backend RPCs + migration"
---

# Tasks: Reservation Creation and Hold Flow

**Input**: Design documents from `specs/008-reservation-creation-flow/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/rpc-contracts.md](./contracts/rpc-contracts.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: Manual SQL test scripts via Supabase SQL Editor. No automated test framework in this phase.

**Organization**: Tasks are grouped by user story. Each story implements one or two RPCs within the same migration file.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Migration path**: `supabase/migrations/20260628000004_reservation_creation_hold_flow.sql`
- **All documentation under**: `specs/008-reservation-creation-flow/`

## Phase 1: Setup (Migration Scaffolding)

**Purpose**: Create the migration file and verify the schema has all required columns.

- [X] T001 Inspect existing `reservation_holds` table schema — verify columns `expires_at` (timestamptz), `created_by` (uuid), and `status` (text with CHECK constraint) exist; if missing, add them in `supabase/migrations/20260628000004_reservation_creation_hold_flow.sql`
- [X] T002 Create migration file `supabase/migrations/20260628000004_reservation_creation_hold_flow.sql` with `begin;` / `commit;` wrapper and `create or replace function` definitions for all three RPCs — start with empty stubs that return `jsonb_build_object('success', false, 'error', 'not implemented')`

---

## Phase 2: Foundational (Shared Infrastructure)

**Purpose**: Reusable helpers and guards that all three RPCs depend on.

- [X] T003 [P] Add `can_write_reservations()` permission guard call at the top of each RPC stub — `if not public.can_write_reservations() then raise exception 'Permission denied' using errcode = '42501'; end if;`
- [X] T004 [P] Add a `validate_dates(p_check_in_date, p_check_out_date)` helper function in the migration — exits early with `jsonb_build_object('success', false, 'error', '...')` if dates are invalid (check_in >= check_out), returns null if valid

**Checkpoint**: Foundation ready. Permission guard and date validation available to all RPCs.

---

## Phase 3: User Story 1 - Draft Reservation with Room Holds (Priority: P1) 🎯 MVP

**Goal**: Create a draft reservation with active holds for selected rooms in a single atomic operation.

**Independent Test**: Call `create_draft_reservation` with guest UUID, dates, and 2 room UUIDs. Verify: (a) reservation created with `status = 'draft'`, (b) two holds created with `status = 'active'` and `expires_at = now() + 30min`, (c) availability query shows rooms as held with `active_hold` conflict type.

### Implementation for User Story 1

- [X] T005 [P] [US1] Implement room validation logic in `create_draft_reservation` — join `rooms` table for the given `p_room_ids`, verify all exist, reject if any have `physical_status IN ('maintenance', 'out_of_order')`, return error listing failed room IDs
- [X] T006 [P] [US1] Implement hold collision check in `create_draft_reservation` — `SELECT ... FROM reservation_holds WHERE room_id = ANY(p_room_ids) AND status = 'active' AND expires_at > now() FOR UPDATE NOWAIT`; if conflicts found and owned by another user, return error listing conflicted room IDs
- [X] T007 [US1] Implement the full `create_draft_reservation` body in `supabase/migrations/20260628000004_reservation_creation_hold_flow.sql` — after validation passes: (a) `INSERT INTO reservations (...)` with `status = 'draft'`, (b) loop over `p_room_ids` inserting one `reservation_holds` row per room with `status = 'active'`, `expires_at = now() + interval '30 minutes'`, `created_by = auth.uid()`, (c) insert `reservation_status_history` entry, (d) insert audit_log entry with action `reservation.draft_created` and `reservation_hold.created` per hold, (e) return success JSON with reservationId, reservationNumber, holdIds

**Checkpoint**: At this point, users can create draft reservations with holds. Run quickstart Scenarios 1, 2, 3, 10 to validate.

---

## Phase 4: User Story 2 - Hold Lifecycle Management (Priority: P2)

**Goal**: Allow hold owners to release holds and handle automatic hold expiry.

**Independent Test**: Call `release_hold` with a valid hold UUID. Verify: (a) hold status changes to `released`, (b) room becomes available in availability query, (c) audit log entry created. Call with another user's hold UUID — verify permission error.

### Implementation for User Story 2

- [X] T008 [P] [US2] Implement `release_hold` in `supabase/migrations/20260628000004_reservation_creation_hold_flow.sql` — (a) validate hold exists with `SELECT ... FOR UPDATE`, (b) validate hold is `active` and `expires_at > now()`, (c) validate hold's `created_by = auth.uid()`, (d) update status to `released`, (e) insert audit_log entry with action `reservation_hold.released`, (f) return success JSON
- [X] T009 [P] [US2] Add lazy expiry logic to `create_draft_reservation` and any hold-querying code — when encountering an active hold with `expires_at <= now()`, update its status to `expired` inline and treat it as expired (not blocking)
- [X] T010 [US2] Add lazy expiry logic to the Phase 7 `get_room_availability` RPC (if not already present) — ensure expired holds are filtered as inactive in `reservation_holds` query within the availability RPC at `supabase/migrations/20260628000003_enhance_room_availability_rpc.sql`

**Checkpoint**: At this point, hold lifecycle works — release and expiry. Run quickstart Scenarios 4, 5 to validate.

---

## Phase 5: User Story 3 - Reservation Confirmation (Priority: P3)

**Goal**: Atomically confirm a draft reservation with full re-validation, converting holds to room assignments.

**Independent Test**: Call `confirm_reservation` with a valid draft reservation UUID. Verify: (a) reservation status changes to `held`, (b) reservation_room records created with `status = 'held'`, (c) audit log entries written. Call with an expired hold — verify full rollback with `failedChecks` containing `checkType = 'hold_expired'`.

### Implementation for User Story 3

- [X] T011 [P] [US3] Implement pre-validation logic block in `confirm_reservation` in `supabase/migrations/20260628000004_reservation_creation_hold_flow.sql` — (a) `SELECT ... FROM reservations WHERE id = p_reservation_id FOR UPDATE`, (b) verify status is `draft`, (c) fetch all holds for this reservation and verify each is active (`expires_at > now()`) and owned by current user, (d) verify no new date overlaps (re-query `reservation_rooms` for overlapping dates), (e) verify no rooms under maintenance/out_of_order, (f) collect all failures into `failedChecks` array
- [X] T012 [US3] Implement the confirmation execution block in `confirm_reservation` — (a) if any pre-validation fails, return `failedChecks` immediately (no changes made), (b) if all pass: update hold statuses to `released`, insert `reservation_rooms` records with status `held` (copy dates from reservation), update reservation status to `held`, insert `reservation_status_history` entry, insert audit_log entries with action `reservation.confirmed`, (c) return success JSON with new status and room IDs — all inside a `begin ... exception when others then ... end` block for atomic rollback
- [X] T013 [US3] Verify `reservation_status` CHECK constraint allows `draft → held` transition — if the constraint is too restrictive (e.g., only allows `confirmed`, `checked_in`, etc.), update it in the migration to allow `held` as a valid post-draft status

**Checkpoint**: At this point, all 3 stories work end-to-end. Run quickstart Scenarios 6, 7, 8, 9 to validate.

---

## Phase 6: Polish & Validation

**Purpose**: Final validation, edge case checks, and documentation updates.

- [X] T014 [P] Verify the migration is idempotent — all functions use `create or replace function`, all column additions use `if not exists`, all constraint additions use `if not exists`
- [X] T015 Run all 10 quickstart scenarios from [quickstart.md](./quickstart.md) end-to-end — document any failures with exact SQL and expected vs actual output
- [X] T016 [P] Validate edge cases from spec: hold expiry at 0 minutes (instant expiry), same-user multiple drafts with overlapping room holds, modifying draft details after creation (FR-013), crash recovery (verifying draft persistence)
- [X] T017 [P] Review all three RPCs for SQL injection safety — all parameters are typed, no dynamic SQL, no string concatenation in WHERE clauses
- [X] T018 [P] Clean up test data after validation — delete test reservations, holds, and audit log entries

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — PREREQUISITE for all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — creates draft + hold RPC
- **US2 (Phase 4)**: Depends on Phase 2 — can start after Foundational; no dependency on US1 content but same migration file
- **US3 (Phase 5)**: Depends on Phase 2 and US1 — confirmation depends on draft creation
- **Polish (Phase 6)**: Depends on all 3 user stories

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P2)**: Can start after Foundational — independent from US1 in logic, but same migration file
- **US3 (P3)**: Depends on US1 (needs draft + holds to exist to test confirmation)

### Within Each User Story

- Tasks marked [P] can be done in parallel (different validation blocks within same RPC)
- RPC body implementation is sequential within a story
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001 (schema inspection) and T002 (migration scaffolding) are parallel
- **Phase 2**: T003 (permission guard) and T004 (date validation) are parallel — different functions
- **Phase 3**: T005 (room validation) and T006 (hold collision check) are parallel — different validation blocks
- **Phase 4**: T008 (release_hold) and T009 (lazy expiry in draft) are parallel
- **Phase 5**: T011 (pre-validation) and T013 (constraint check) are parallel
- **Phase 6**: T014, T016, T017, T018 are parallel

---

## Parallel Example: User Story 1

```bash
# T005 and T006 are parallel (different validation blocks)
Task: "Implement room validation logic in create_draft_reservation"
Task: "Implement hold collision check in create_draft_reservation"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration scaffolding)
2. Complete Phase 2: Foundational (permission guard + date validation)
3. Complete Phase 3: User Story 1 (create_draft_reservation)
4. **STOP and VALIDATE**: Run quickstart Scenarios 1, 2, 3, 10
5. Deploy/demo if ready — draft with holds is functional

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Draft with holds works → Test (MVP!)
3. Add US2 → Hold release and expiry works → Test
4. Add US3 → Confirmation with re-validation works → Test
5. Final Polish → All scenarios validated

### Sequential Strategy (Recommended)

Since all 3 stories modify the same migration file, a single developer follows priority order:

1. US1: create_draft_reservation (draft + holds)
2. US2: release_hold + lazy expiry
3. US3: confirm_reservation (atomic confirmation)
4. Polish: End-to-end validation

---

## Notes

- [P] tasks = different functions or validation blocks, can be written independently
- Each user story produces a testable checkpoint — run corresponding quickstart scenarios
- No new tables are created — schema additions are limited to columns on `reservation_holds` if missing
- The migration uses `create or replace function` for idempotency
- No TypeScript, no frontend, no new dependencies
- Manual SQL testing via Supabase SQL Editor for all scenarios

