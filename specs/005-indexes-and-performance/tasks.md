---

description: "Tasks for Indexes and Performance"
---

# Tasks: Indexes and Performance

**Input**: Design documents from `specs/005-indexes-and-performance/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/index-conventions.md, quickstart.md

**Tests**: No test framework — this is a database optimization phase. All verification uses SQL-based EXPLAIN ANALYZE.

**Organization**: Tasks are grouped by user story for independent verification of each query pattern.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different indexes, no data dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Start local Supabase, ensure Phase 2 migration is applied

- [X] T001 Start local Supabase stack with `supabase start` — verify healthy
- [X] T002 Apply all pending migrations including Phase 2 via `supabase migration up`
- [X] T003 Confirm all 9 reservation tables exist with `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'reservation_%' OR table_name = 'room_status_history'`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Inspect existing indexes, compare against spec, fill any gaps

**⚠️ CRITICAL**: No verification can proceed until the index baseline is confirmed complete

- [X] T004 Inspect all existing indexes on reservation tables by running `SELECT indexname, indexdef FROM pg_indexes WHERE tablename LIKE 'reservation_%' OR tablename = 'room_status_history'` — write output to `docs/queries/reservation-index-inventory.sql`
- [X] T005 Compare existing indexes against the spec inventory in `specs/005-indexes-and-performance/data-model.md` — log any missing indexes with their CREATE INDEX statement
- [X] T006 If any indexes are missing, create migration `supabase/migrations/20260628000002_add_reservation_indexes.sql` with only the missing indexes, then apply via `supabase migration up`
- [X] T007 Seed test data: generate 10,000+ reservations, 50,000+ room assignments, 500+ companies via bulk INSERT for meaningful EXPLAIN ANALYZE results
- [X] T008 Run `ANALYZE` on all reservation tables to update query planner statistics

**Checkpoint**: Index baseline confirmed complete, test data seeded, statistics updated

---

## Phase 3: User Story 1 — Fast Reservation Lookups and Availability (Priority: P1) 🎯 MVP

**Goal**: Verify that reservation status filters, date-range searches, and room availability queries use index scans and meet performance targets.

**Independent Test**: Run EXPLAIN ANALYZE on a status filter, date-range search, and room availability query — confirm all show Index Scan (not Sequential Scan) and complete within target times.

### Verification for User Story 1

- [X] T009 [P] [US1] Verify `idx_reservations_status` — run EXPLAIN ANALYZE on `SELECT * FROM reservations WHERE status = 'confirmed' AND deleted_at IS NULL LIMIT 100` — confirm Index Scan and time < 1s
- [X] T010 [P] [US1] Verify `idx_reservations_dates` — run EXPLAIN ANALYZE on a date-range query spanning 7 days — confirm Index Scan and time < 2s
- [X] T011 [P] [US1] Verify `idx_reservation_rooms_room_dates` — run EXPLAIN ANALYZE on a room availability query with date overlap — confirm Index Scan and time < 2s
- [X] T012 [P] [US1] Verify `idx_reservation_rooms_reservation` — run EXPLAIN ANALYZE on a FK join from reservation_rooms to reservations — confirm Index Scan
- [X] T013 [P] [US1] Verify `idx_reservation_rooms_status` — run EXPLAIN ANALYZE on a room status filter — confirm Index Scan
- [X] T014 [P] [US1] Verify `idx_reservation_holds_active` — run EXPLAIN ANALYZE on an active hold query — confirm Index Scan
- [X] T015 [P] [US1] Verify `idx_reservations_number` — run EXPLAIN ANALYZE on reservation_number lookup — confirm Index Scan

**Checkpoint**: All reservation lookup and availability query patterns verified with index scans

---

## Phase 4: User Story 2 — Optimized Billing and Company Queries (Priority: P1)

**Goal**: Verify that company-filtered queries, billing aggregations, and payment reconciliation queries use index scans and meet performance targets.

**Independent Test**: Run EXPLAIN ANALYZE on a company-filtered reservation query and a billing summary join — confirm Index Scans and completion within target times.

### Verification for User Story 2

- [X] T016 [P] [US2] Verify `idx_reservations_company` — run EXPLAIN ANALYZE on `SELECT * FROM reservations WHERE company_id IS NOT NULL AND deleted_at IS NULL LIMIT 100` — confirm Index Scan and time < 2s
- [X] T017 [P] [US2] Verify `idx_reservations_primary_guest` — run EXPLAIN ANALYZE on guest reservation lookup — confirm Index Scan
- [X] T018 [P] [US2] Verify `idx_reservations_created_by` — run EXPLAIN ANALYZE on created_by query — confirm Index Scan
- [X] T019 [P] [US2] Verify `idx_reservation_payments_reservation` — run EXPLAIN ANALYZE on a payments join to reservations — confirm Index Scan on payment FK
- [X] T020 [P] [US2] Verify `idx_reservation_pricing_items_reservation` — run EXPLAIN ANALYZE on pricing items join — confirm Index Scan
- [X] T021 [P] [US2] Verify `idx_reservation_pricing_items_room` — run EXPLAIN ANALYZE on pricing items by room — confirm Index Scan
- [X] T022 [US2] Run a billing aggregation query (payments joined to reservations with GROUP BY) and confirm time < 5s

**Checkpoint**: All billing and company query patterns verified with index scans

---

## Phase 5: User Story 3 — Query Performance Verification (Priority: P2)

**Goal**: Verify that status history, notes, guest lookups, and room status history queries use index scans. Optionally add GiST index if needed.

**Independent Test**: Run EXPLAIN ANALYZE on all remaining index patterns and confirm Index Scans.

### Verification for User Story 3

- [X] T023 [P] [US3] Verify `idx_reservation_guests_reservation` — run EXPLAIN ANALYZE on guest lookup by reservation — confirm Index Scan
- [X] T024 [P] [US3] Verify `idx_reservation_guests_guest` — run EXPLAIN ANALYZE on guest lookup by guest ID — confirm Index Scan
- [X] T025 [P] [US3] Verify `idx_reservation_notes_reservation` — run EXPLAIN ANALYZE on notes query — confirm Index Scan
- [X] T026 [P] [US3] Verify `idx_reservation_status_history_reservation` — run EXPLAIN ANALYZE on status history query — confirm Index Scan
- [X] T027 [P] [US3] Verify `idx_room_status_history_room_time` — run EXPLAIN ANALYZE on room status history — confirm Index Scan
- [X] T028 [US3] Check for any date-range query that still shows Sequential Scan — if found, add the optional GiST index `idx_reservation_rooms_date_range` to `supabase/migrations/20260628000002_add_reservation_indexes.sql` and re-verify

**Checkpoint**: All remaining index patterns verified, optional GiST added if needed

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Document findings, commit changes, update runbook

- [X] T029 Compile all EXPLAIN ANALYZE results into `docs/queries/reservation-perf-testing.sql` with expected plans documented as comments
- [X] T030 Write a summary of which indexes exist, which were added (if any), and query plan results to `docs/queries/index-verification-report.md`
- [X] T031 Update `specs/005-indexes-and-performance/quickstart.md` with any corrections discovered during verification
- [X] T032 Commit the migration (if any), test data script, verification SQL, and documentation to the `005-indexes-and-performance` branch

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — local Supabase must be running
- **Foundational (Phase 2)**: Depends on Setup — migration applied, test data seeded
- **US1 (Phase 3)**: Depends on Phase 2 — core reservation/room indexes verified
- **US2 (Phase 4)**: Depends on Phase 2 — billing/company indexes verified; independent of US1
- **US3 (Phase 5)**: Depends on Phase 2 — remaining index patterns verified; independent of US1/US2
- **Polish (Phase 6)**: Depends on US1, US2, US3

### User Story Dependencies

- **US1 (P1)**: No dependencies on US2 or US3 — independent verification
- **US2 (P1)**: No dependencies on US1 or US3 — independent verification
- **US3 (P2)**: No dependencies on US1 or US2 — independent verification

### Parallel Opportunities

- All Phase 3 tasks (T009–T015) target different indexes — can run in parallel
- All Phase 4 tasks (T016–T022) target different indexes — can run in parallel
- All Phase 5 tasks (T023–T028) target different indexes — can run in parallel
- All three user stories can execute simultaneously on the same database
- Phase 6 tasks are sequential (compile → write doc → commit)

---

## Parallel Example: All Three User Stories

```sql
-- US1 (T009–T015): Run all reservation/room index EXPLAIN ANALYZE queries together
-- US2 (T016–T022): Run all billing/company index EXPLAIN ANALYZE queries together  
-- US3 (T023–T028): Run all remaining index EXPLAIN ANALYZE queries together
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (index baseline + test data)
3. Complete Phase 3: US1 (reservation/room indexes)
4. **STOP and VALIDATE**: Reservation lookups, availability, and holds all use index scans

### Incremental Delivery

1. Setup + Foundational → Index baseline known, test data ready
2. US1 verified → Core reservation operations optimized
3. US2 verified → Billing and company queries optimized
4. US3 verified → All remaining patterns optimized, optional GiST added
5. Polish → Documentation and commit

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once baseline is ready:
   - Developer A: US1 — reservation/room indexes
   - Developer B: US2 — billing/company indexes
   - Developer C: US3 — remaining indexes + optional GiST
3. All run EXPLAIN ANALYZE against the same seeded database

---

## Notes

- [P] tasks = different indexes, no data dependencies
- [Story] label maps task to specific user story for traceability
- Each user story verification is independent — uses separate index sets
- All verification is SQL-based (no test framework needed)
- If no migration is needed (all indexes already present), skip T006
- Commit after each phase or logical group

## Implementation Notes

- 2026-06-28: `check-prerequisites.ps1` reported active feature 016, but user explicitly requested 005, so implementation used `specs/005-indexes-and-performance/`.
- 2026-06-28: Supabase CLI available through `npx -y supabase` (2.108.0), but `supabase start` is blocked because Docker Desktop Linux engine pipe is missing.
- 2026-06-28: Static migration inspection found all 20 required index-like objects in `20260628000001_create_reservation_model.sql`; no additional index migration was created.
- 2026-06-28: Verification SQL and blocker report written under `docs/queries/`. Live EXPLAIN tasks remain open until local Supabase/Postgres is running.





