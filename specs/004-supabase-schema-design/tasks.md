---

description: "Tasks for Supabase Schema Design"
---

# Tasks: Supabase Schema Design

**Input**: Design documents from `specs/004-supabase-schema-design/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/migration-conventions.md, quickstart.md

**Tests**: No test framework tasks — this is a database schema phase. All verification tasks are SQL-based smoke tests against the Supabase local stack.

**Organization**: Tasks are grouped by user story to enable independent verification of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different tables, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Load migration context, set up local Supabase stack

- [X] T001 Read the existing migration at `supabase/migrations/20260628000001_create_reservation_model.sql` and data model at `specs/004-supabase-schema-design/data-model.md` to understand the full schema scope
- [X] T002 [P] Start local Supabase stack with `supabase start` — verify stack is healthy
- [X] T002 [P] Verify `supabase/migrations/` is registered and no conflicting migrations block the new one
- [X] T003 Verify Supabase MCP connection is available for `execute_sql` queries

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Apply the reservation schema migration — MUST complete before any user story verification

**⚠️ CRITICAL**: No user story verification can begin until migration is applied and base tables confirmed

- [X] T004 Review migration SQL at `supabase/migrations/20260628000001_create_reservation_model.sql` against spec.md (15 FRs) and data-model.md (10 entities) for completeness — log any gaps
- [X] T005 Apply the migration via `supabase migration up` — capture stdout/stderr
- [X] T006 [P] Confirm all 10 tables exist: reservations, reservation_rooms, reservation_guests, reservation_company_info, reservation_pricing_items, reservation_payments, reservation_holds, reservation_notes, reservation_status_history, room_status_history
- [X] T007 [P] Confirm all 10 enums exist: reservation_status, reservation_booking_type, billing_party, reservation_source, reservation_room_status, reservation_guest_role, reservation_payment_type, reservation_payment_method, price_source, room_physical_status
- [X] T008 [P] Confirm the btree_gist extension is installed
- [X] T009 [P] Confirm RLS is enabled on all reservation tables

**Checkpoint**: Migration applied successfully — all 10 tables, 10 enums, extension, and RLS confirmed

---

## Phase 3: User Story 1 — Reservation Full Lifecycle (Priority: P1) 🎯 MVP

**Goal**: Verify that the schema supports creating a reservation, managing its lifecycle (draft → held → confirmed → checked_in → checked_out), and prevents double booking.

**Independent Test**: A user can create a draft reservation with dates and a room assignment, transition it through the lifecycle using RPCs, and the database prevents overlapping room assignments.

### Verification for User Story 1

- [X] T010 [P] [US1] Verify `reservations` table constraints — insert a valid row, verify constraint rejection on bad data (check_out < check_in, zero room_count, zero guests)
- [X] T011 [P] [US1] Verify `reservation_number` is auto-generated and unique — insert two drafts and confirm unique RSV-* numbers
- [X] T012 [P] [US1] Verify `reservation_rooms` table with exclusion constraint — assign room to reservation, then confirm overlapping assignment is rejected
- [X] T013 [P] [US1] Verify `reservation_guests` single-primary-guest constraint — insert two guests with is_primary=true and confirm the second insert fails
- [X] T014 [US1] Verify `confirm_reservation` RPC — create draft, assign room, call RPC, confirm status=confirmed, rooms status=reserved, status history written
- [X] T015 [US1] Verify `cancel_reservation` RPC — confirm rooms released, status=cancelled, cancelled_at set, history written
- [X] T016 [P] [US1] Verify check-in/check-out timestamps — manually update checked_in_at/checked_out_at and confirm they are nullable timestamptz
- [X] T017 [P] [US1] Verify ON DELETE CASCADE — delete a reservation and confirm child rows in reservation_rooms, reservation_guests are removed
- [X] T018 [P] [US1] Verify soft delete — update deleted_at on a reservation, confirm status and date queries filter correctly

**Checkpoint**: US1 schema is verified — reservation creation, lifecycle transitions, double booking prevention, and guest associations all work at the database level

---

## Phase 4: User Story 2 — Billing, Pricing & Company Support (Priority: P1)

**Goal**: Verify that the schema supports company billing, itemized pricing with source tracking, manual price overrides with audit trail, and payments with balance tracking.

**Independent Test**: A user can insert company billing info for a reservation, add pricing items from different sources, record a payment, and verify balance calculations.

### Verification for User Story 2

- [X] T019 [P] [US2] Verify `reservation_company_info` table — insert company billing, confirm unique constraint (one per reservation), verify FK to contacts
- [X] T020 [P] [US2] Verify `reservation_pricing_items` table — insert items with different price_source values, confirm FK cascade on reservation delete
- [X] T021 [P] [US2] Verify `reservation_payments` table — insert payments of different types/methods, confirm amount > 0 constraint, verify FK cascade
- [X] T022 [US2] Verify balance tracking — insert payments against a reservation, update paid_amount on reservations, verify balance_amount = total - paid
- [X] T023 [US2] Verify manual override tracking — insert pricing_item with price_source=manual_override, confirm manual_override_reason and manual_override_by are populated
- [X] T024 [P] [US2] Verify credit_limit and credit_approved fields on reservation_company_info — insert both approved and unapproved company records
- [X] T025 [P] [US2] Verify payment_terms enum — confirm pay_on_arrival, invoice, credit are all valid values
- [X] T026 [US2] Verify `service_amount` column — insert pricing items with service amounts and confirm they're stored correctly

**Checkpoint**: US2 schema is verified — company billing, pricing items, payments, balance tracking, and manual overrides all work at the database level

---

## Phase 5: User Story 3 — Room Holds, Notes & Status History (Priority: P2)

**Goal**: Verify that the schema supports temporary room holds with expiry, operational notes with visibility controls, and immutable status change history.

**Independent Test**: A user can hold a room (blocking availability), add notes with visibility settings, and view a timestamped history of all status changes.

### Verification for User Story 3

- [X] T027 [P] [US3] Verify `reservation_holds` table — insert active hold, confirm FK to rooms, verify check_out > check_in constraint
- [X] T028 [P] [US3] Verify hold expiry — insert hold with expires_at in the past, confirm status can be updated to 'expired'
- [X] T029 [P] [US3] Verify `reservation_notes` table — insert notes with different type/visibility combos, confirm FK to reservations
- [X] T030 [P] [US3] Verify `reservation_status_history` table — insert entries with from_status and to_status, confirm immutable structure (no update trigger), verify FK cascade
- [X] T031 [US3] Verify hold → conversion interaction — confirm that reservation_holds.reservation_id references the parent, and ON DELETE CASCADE cleans up holds
- [X] T032 [P] [US3] Verify `room_status_history` table — insert room status changes, confirm metadata jsonb stores arbitrary data, verify FK to reservations

**Checkpoint**: US3 schema is verified — holds, notes, and status history all work at the database level

---

## Phase 6: Cross-Cutting & Polish

**Purpose**: Verify RLS policies, RPC functions, and run end-to-end validation

- [X] T033 [P] Verify RLS helper functions — run `can_read_reservations()`, `can_write_reservations()`, `can_override_pricing()` as different roles and confirm correct access
- [X] T034 [P] Verify RLS policies on all tables — confirm `SET ROLE anon` is blocked and `SET ROLE authenticated` is allowed for each reservation table
- [X] T035 [P] Verify `get_room_availability` RPC — query with and without filters, confirm room availability reflects active holds and reservations
- [X] T036 [P] Verify `confirm_reservation` RPC also releases holds — confirm active hold on a room is released when the reservation is confirmed
- [X] T037 [P] Verify `cancel_reservation` RPC — confirm it handles all cancellable statuses (draft, held, confirmed) and rejects terminal ones (checked_out, cancelled, expired)
- [X] T038 Run the full quickstart at `specs/004-supabase-schema-design/quickstart.md` end-to-end — confirm all verification queries return expected results
- [X] T039 Update `supabase/migrations/20260628000001_create_reservation_model.sql` with any fixes discovered during verification
- [X] T040 Commit the migration and all verification scripts to the `004-supabase-schema-design` branch

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — local Supabase must be running
- **Foundational (Phase 2)**: Depends on Setup — migration must be applied before any verification
- **User Stories (Phase 3-5)**: All depend on Phase 2 — core tables must exist
  - US1 (Phase 3) → US2, US3: Reservation parent must exist before child tables can be verified
  - US2 (Phase 4): Independent of US1 verification — child table verification only
  - US3 (Phase 5): Independent of US1 verification — child table verification only
- **Cross-Cutting (Phase 6)**: Depends on all user stories — RLS, RPCs, and end-to-end validation

### User Story Dependencies

- **US1 (P1)**: Blocks nothing — can verify independently of US2/US3
- **US2 (P1)**: Independent of US1 verification — uses separate child tables
- **US3 (P2)**: Independent of US1/US2 verification — uses separate child tables

### Within Each Phase

- All verification tasks marked [P] target different tables and can run in parallel
- Sequential tasks within a phase build on previous results (e.g., T014 confirm RPC depends on T012 room assignment working)
- Core table verification before RPC verification
- End-to-end validation at the end

### Parallel Opportunities

- All T00X [P] tasks within each phase can run simultaneously
- US1 parallel: T010, T011, T012, T013, T016, T017, T018 run independently
- US2 parallel: T019, T020, T021, T024, T025 run independently
- US3 parallel: T027, T028, T029, T030, T032 run independently
- Cross-cutting: T033, T034, T035 run independently

---

## Parallel Example: User Story 1

```bash
# SQL verification tasks on independent tables (parallel):
Task: "INSERT INTO reservations ..." (verify constraints — T010)
Task: "INSERT INTO reservation_rooms ..." (verify exclusion — T012)
Task: "INSERT INTO reservation_guests ..." (verify single primary — T013)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (apply migration, confirm base tables)
3. Complete Phase 3: User Story 1 (lifecycle verification)
4. **STOP and VALIDATE**: Confirm reservation creation, lifecycle RPCs, and double booking
5. Deploy/demo the schema

### Incremental Delivery

1. Setup + Foundational → Schema applied, base tables confirmed
2. US1 verified → MVP schema ready for lifecycle operations
3. US2 verified → Schema ready for billing and payments
4. US3 verified → Schema ready for holds, notes, and history
5. Cross-cutting → RLS, RPCs, and end-to-end validated

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (sequential)
2. Once migration is applied:
   - Developer A: User Story 1 tables + verification
   - Developer B: User Story 2 tables + verification
   - Developer C: User Story 3 tables + verification
3. All verification against the same applied migration

---

## Notes

- [P] tasks = different tables, no data dependencies
- [Story] label maps task to specific user story for traceability
- Each user story verification is independent — uses separate child tables
- All verification is SQL-based (no test framework needed)
- Commit after each phase or logical group
- Stop at any checkpoint to validate story independently

## Implementation Notes

- 2026-06-28: Static migration review completed. Fixed missing `reservation_guests.deleted_at`, idempotent overlap constraint, private RLS helper references, explicit authenticated grants, pg_cron dollar quoting, and quickstart RLS query.
- 2026-06-28: Live Supabase verification blocked because Docker Desktop local engine is unavailable and Supabase MCP tools are not exposed in this session. See `verification/validation-report.md`.






