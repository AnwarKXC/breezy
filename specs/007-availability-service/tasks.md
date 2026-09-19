---

description: "Task list for Availability RPC enhancement — backend-only SQL migration"
---

# Tasks: Availability RPC / Service

**Input**: Design documents from `specs/007-availability-service/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rpc-contract.md](./contracts/rpc-contract.md)

**Tests**: Manual SQL test scripts via Supabase SQL Editor (pgTAM deferred). No automated test framework in this phase.

**Organization**: Tasks are grouped by user story to enable incremental delivery. Each story modifies the same migration file but introduces independently testable functionality.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Migration path**: `supabase/migrations/20260628000003_enhance_room_availability_rpc.sql`
- **All documentation under**: `specs/007-availability-service/`

## Phase 1: Setup (Migration Scaffolding)

**Purpose**: Create the migration file and establish the enhancement pattern. This replaces the `get_room_availability` RPC function in a `CREATE OR REPLACE` migration.

- [X] T001 Create migration file `supabase/migrations/20260628000003_enhance_room_availability_rpc.sql` with `CREATE OR REPLACE FUNCTION public.get_room_availability(...)` using the enhanced return signature from [contracts/rpc-contract.md](./contracts/rpc-contract.md) — start with a `RETURNS TABLE(...)` that preserves the original scalar columns and adds `can_select boolean`, `select_disabled_reason text`, `available_from date`, `available_until date`, `price_preview jsonb`, `conflicts jsonb`
- [X] T002 [P] Add `can_read_reservations()` permission guard at the top of the function body — call `if not public.can_read_reservations() then raise exception 'Permission denied' using errcode = '42501'; end if;`

---

## Phase 2: User Story 1 - Room Availability Lookup (Priority: P1) 🎯 MVP

**Goal**: Return all rooms with the correct 11-value `availability_status`, `can_select` boolean, `select_disabled_reason`, and `available_from`/`available_until` dates — for any given check-in/check-out range.

**Independent Test**: Call `get_room_availability('2026-08-01', '2026-08-03')` and verify each room has a valid `availability_status` from the 11-value enum, `can_select` follows the truth table in [data-model.md](./data-model.md#canselect-truth-table), and rooms with no conflicts return `available_for_full_stay`.

### Implementation for User Story 1

- [X] T003 [US1] Add input validation block at top of function — raise exception when `p_check_in_date >= p_check_out_date` ('Check-in date must be before check-out date') or stay > 90 days ('Maximum stay is 90 days')
- [X] T004 [US1] Enhance the CTE `overlapping_rooms` to include extra reservation metadata needed for status determination: `reservation.status`, `reservation.check_in_date` as `res_check_in`, `reservation.check_out_date` as `res_check_out`, and a comparison of overlap extent (full vs partial coverage of requested range)
- [X] T005 [US1] Expand the `availability_status` CASE expression in `room_base` (after `current_room_status` pre-filtering) to return all 11 statuses per the matrix in [data-model.md](./data-model.md#availability-status-matrix):
  - `available_for_full_stay` — no overlaps, clean, not under maintenance
  - `booked` — overlapping reservation covers full requested range
  - `occupied_now` — reservation currently in occupied status
  - `reserved_in_future` — reservation exists but check_in > p_check_in
  - `due_out_today` — guest check-out = p_check_in date
  - `available_after_checkout` — reservation ends before p_check_out
  - `available_after_cleaning` — room is dirty (housekeeping_status = 'dirty')
  - `partially_available` — partial overlap, not full range
  - `not_available` — multiple reservations cover full range
  - `blocked` — room_physical_status = 'blocked'
  - `maintenance` — room_physical_status IN ('maintenance', 'out_of_order')
- [X] T006 [P] [US1] Add `can_select` and `select_disabled_reason` columns — use CASE with availability_status as input, mapping to the truth table in [data-model.md](./data-model.md#canselect-truth-table). For `can_select = true`, return `select_disabled_reason = null`
- [X] T007 [P] [US1] Add `available_from` and `available_until` date columns — set for partial statuses (`partially_available` → next available window, `available_after_checkout` → checkout date, `due_out_today` → p_check_in_date at check-out time, `reserved_in_future` → future conflict check_in date); null for binary statuses (`booked`, `occupied_now`, `available_for_full_stay`)

**Checkpoint**: At this point, calling `get_room_availability(date, date)` returns all rooms with correct status, canSelect, and availability window dates. Run quickstart Scenarios 1, 5, 6 to validate.

---

## Phase 3: User Story 2 - Availability Filtering and Price Preview (Priority: P2)

**Goal**: Support optional filters (`p_room_type_id`, `p_adults`, `p_children`, `p_include_dirty`, `p_include_maintenance`) and return a `price_preview` JSONB column with company override support.

**Independent Test**: Call with `p_room_type_id` filter — only matching room type returned. Call with `p_company_id` — `price_preview.priceSource = 'company_override'`. Call with `p_include_dirty = false` — dirty rooms have `availability_status = 'available_after_cleaning'`.

### Implementation for User Story 2

- [X] T008 [P] [US2] Verify the `room_base` CTE already includes `WHERE` filters for `p_room_type_id`, `p_adults`, `p_children` per the existing RPC — ensure capacity filter uses `capacity >= (coalesce(p_adults, 0) + coalesce(p_children, 0))`
- [X] T009 [P] [US2] Verify the `room_base` CTE already pre-filters `r.physical_status` for maintenance/out-of-order and `r.housekeeping_status` for dirty — if not already present, add `r.physical_status` to the room_base SELECT and add WHERE exclusions for maintenance/out_of_order (when `p_include_maintenance = false`) and dirty (when `p_include_dirty = false`)
- [X] T010 [US2] Add a `pricing` CTE that LEFT JOINs `room_types` and `company_price_overrides` — compute `rate_per_night` as `coalesce(cpo.override_rate, rt.default_rate)`, `total_amount` as `rate_per_night * (p_check_out_date - p_check_in_date)`, `currency` from `rt.currency`, and `price_source` as `'company_override'` (when cpo row found) or `'default_rate'` — return as a single `jsonb_build_object` column called `price_preview`
- [X] T011 [US2] LEFT JOIN the pricing CTE to the main SELECT and pass `price_preview` to the output — ensure it's `jsonb_build_object('ratePerNight', ...)` not null (use COALESCE or a fallback if room type missing)

**Checkpoint**: At this point, filtering and pricing work. Run quickstart Scenarios 3, 4, 7, 8, 9 to validate.

---

## Phase 4: User Story 3 - Availability Conflict Detail (Priority: P3)

**Goal**: Return a `conflicts` JSONB array per room with detailed conflict information for non-available rooms.

**Independent Test**: For a room with status `booked`, the `conflicts` array contains at least one entry with `reservationId`, `reservationNumber`, `guestName`, `conflictType = 'date_overlap'`.

### Implementation for User Story 3

- [X] T012 [US3] Add a `conflicts` CTE that collects overlapping reservations per room — inner join `overlapping_rooms` with `public.guests` (via `reservation.primary_guest_id`) and `public.contacts` (via `reservation.company_id`) to resolve names, then `jsonb_agg(jsonb_build_object(...)) group by room_id` to produce the JSON array. Include fields: `reservationId`, `reservationNumber`, `guestName`, `companyName`, `checkInDate`, `checkOutDate`, `conflictType`, `message` (human-readable string built with concatenation)
- [X] T013 [US3] Add `active_holds` entries to the conflicts CTE via UNION ALL — include the reservation_holds row with `conflictType = 'active_hold'` and `guestName = 'Hold'` (or similar placeholder since holds are not linked to guests)
- [X] T014 [US3] Add room-level conflicts for `blocked` and `maintenance` statuses — when `current_room_status = 'blocked'`, inject a conflict entry with `conflictType = 'blocked'` and message "Room is blocked". When in maintenance, inject `conflictType = 'maintenance'`
- [X] T015 [US3] LEFT JOIN the conflicts CTE to the main SELECT — use `COALESCE(cf.conflicts, '[]'::jsonb)` so non-conflicted rooms still have a valid empty array

**Checkpoint**: At this point, all 3 stories are implemented. Run quickstart Scenarios 2, 10 to validate conflict details.

---

## Phase 5: Polish & Validation

**Purpose**: Final validation, cleanup, and verify all quickstart scenarios pass end-to-end.

- [X] T016 [P] Verify the migration is idempotent — uses `CREATE OR REPLACE FUNCTION` (not plain `CREATE`) so it can be re-run on Supabase migration up
- [X] T017 Verify all 11 availability statuses are reachable — create test data for each status condition and call the RPC to confirm correct mapping per [data-model.md](./data-model.md#availability-status-matrix)
- [X] T018 Run all 10 quickstart scenarios from [quickstart.md](./quickstart.md) end-to-end — document any failures with the exact SQL used and the expected vs actual output
- [X] T019 [P] Validate edge cases: empty result set (returns zero rows not error), company fallback (no override → default rate), vacant-future-room returns `reserved_in_future`
- [X] T020 [P] Review the final migration for SQL injection safety — all parameters are typed (`date`, `uuid`, `int`, `boolean`), no dynamic SQL, no string concatenation in WHERE clauses

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 (Phase 2)**: Depends on Phase 1 completion — defines the core function structure
- **US2 (Phase 3)**: Depends on Phase 2 completion — modifies the same function body with additional CTEs and output columns
- **US3 (Phase 4)**: Depends on Phase 3 completion — adds conflicts CTE on top of the existing structure
- **Polish (Phase 5)**: Depends on all 3 user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Setup — no dependencies on other stories
- **US2 (P2)**: Must follow US1 — adds to the same function body
- **US3 (P3)**: Must follow US2 — adds to the same function body

### Within Each User Story

- Tasks marked [P] can be done in parallel (different parts of the CASE expression or different columns)
- All tasks within a story modify the same migration file — commit after each story completes
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001 and T002 are parallelizable
- **Phase 2**: T006 (canSelect) and T007 (availableFrom/Until) are parallel as they modify different CASE expressions
- **Phase 3**: T008 and T009 (filter verification) are parallel, but T010 (pricing CTE) depends on understanding the filter structure
- **Phase 4**: All tasks modify the same conflicts CTE — sequential
- **Phase 5**: T016, T019, T020 are parallelizable (verification of different aspects)

---

## Parallel Example: User Story 1

```bash
# T006 and T007 are parallel (different expressions in same file)
Task: "Add can_select and select_disabled_reason columns in supabase/migrations/20260628000003_enhance_room_availability_rpc.sql"
Task: "Add available_from and available_until date columns in supabase/migrations/20260628000003_enhance_room_availability_rpc.sql"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration scaffolding + permission guard)
2. Complete Phase 2: User Story 1 (core availability with 11 statuses, canSelect, validation)
3. **STOP and VALIDATE**: Run quickstart Scenarios 1, 5, 6
4. Deploy/demo if ready — basic availability query is functional

### Incremental Delivery

1. Complete Setup (Phase 1) → Foundation ready
2. Add US1 (Phase 2) → Core availability query works → Test (MVP!)
3. Add US2 (Phase 3) → Filtering and pricing works → Test
4. Add US3 (Phase 4) → Conflict details work → Test
5. Final Polish (Phase 5) → All scenarios validated

### Sequential Strategy (Recommended)

Since all 3 stories modify the same migration file, a single developer follows the priority order:

1. US1: Basic availability (status, canSelect, availableFrom/Until, validation)
2. US2: Add filters and pricing
3. US3: Add conflict details
4. Polish: End-to-end validation

---

## Notes

- [P] tasks = different parts of the same file, but can be written independently
- Each user story produces a testable checkpoint — run corresponding quickstart scenarios
- No new tables are created — all changes are within the single migration file
- The migration uses `CREATE OR REPLACE FUNCTION` for idempotency
- No TypeScript, no frontend, no new dependencies
- Manual SQL testing via Supabase SQL Editor for all scenarios


