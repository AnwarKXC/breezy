---

description: "Task list for RLS and security policy refinement"
---

# Tasks: RLS and Security

**Input**: Design documents from `/specs/006-rls-and-security/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test SQL scripts are included per user story for manual verification of RLS behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Migration**: `supabase/migrations/20260628000002_refine_reservation_rls.sql` (single file)
- **Test scripts**: `specs/006-rls-and-security/tests/` directory
- All other artifacts under `specs/006-rls-and-security/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Review existing schema and prepare migration scaffolding

- [X] T001 Review existing RLS helpers in `supabase/migrations/20260628000001_create_reservation_model.sql` — confirm `can_read_reservations()`, `can_write_reservations()`, `can_override_pricing()` signatures and behavior
- [X] T002 [P] Review existing `current_app_role()` and `is_admin()` functions in `supabase/migrations/20260511222709_harden_initial_app_schema.sql` — confirm they return correct values for all 3 roles
- [X] T003 [P] Review existing RLS policies on all 9 reservation tables — inventory which policies will be kept, dropped, or replaced
- [X] T004 [P] Review existing RPC bodies in `supabase/migrations/20260628000001_create_reservation_model.sql` — identify where permission guards need to be added (confirm_reservation, cancel_reservation, check_in, check_out, get_room_availability)
- [X] T005 Create empty migration file `supabase/migrations/20260628000002_refine_reservation_rls.sql` with header comment and `btree_gist` extension check

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

**Purpose**: Create new helper functions that all policies depend on

- [X] T006 [P] Create `public.can_manage_internal_notes()` — returns `is_admin()` — in `supabase/migrations/20260628000002_refine_reservation_rls.sql`
- [X] T007 [P] Create `public.can_manage_guarantee()` — returns true for any authenticated user (policy handles override logic) — in migration file
- [X] T008 [P] Create `public.can_force_assign_room()` — returns `is_admin()` — in migration file
- [X] T009 [P] Create `public.can_refund_payment()` — returns `is_admin()` — in migration file
- [X] T010 [P] Create `public.can_delete_reservations()` — returns `is_admin()` — in migration file
- [X] T011 [P] Create `public.can_cancel_reservations()` — returns `is_admin()` — in migration file

**Checkpoint**: Foundation ready — all 6 new helper functions created. User story implementation can now begin.

---

## Phase 3: User Story 1 — Role-Based Access Control (Priority: P1) 🎯 MVP

**Goal**: Front desk can create/read/update/confirm/check-in/check-out/record payments but not cancel, override pricing, delete, or refund. Accountants read-only. Admins full access.

**Independent Test**: Connect as `app_role = 'front_desk'`, insert a reservation (succeeds), delete a reservation (blocked), override pricing (blocked). Connect as `app_role = 'accountant'`, select payments (succeeds), insert reservation (blocked).

### Helper & RPC Updates for US1

- [X] T012 [P] [US1] Add permission guard to `cancel_reservation()` — call `can_cancel_reservations()` and raise `42501` on failure — in migration file
- [X] T013 [P] [US1] Add permission guard to `check_in()` — call `can_write_reservations()` — in migration file
- [X] T014 [P] [US1] Add permission guard to `check_out()` — call `can_write_reservations()` — in migration file
- [X] T015 [P] [US1] Add permission guard to `confirm_reservation()` — call `can_write_reservations()` — in migration file
- [X] T016 [P] [US1] Add permission guard to `get_room_availability()` — call `can_read_reservations()` — in migration file

### Policy Refinements for US1

- [X] T017 [P] [US1] Drop existing coarse policies on `reservations` table in migration file
- [X] T018 [P] [US1] Create refined `reservations_select_staff` using `can_read_reservations()` in migration file
- [X] T019 [P] [US1] Create refined `reservations_insert_writers` using `can_write_reservations()` in migration file
- [X] T020 [US1] Create refined `reservations_update_writers` — base write check + pricing column guard using `can_override_pricing()` + internal_notes guard using `can_manage_internal_notes()` + deleted_at block — in migration file
- [X] T021 [P] [US1] Create `reservations_delete_admin` using `can_delete_reservations()` in migration file
- [X] T022 [P] [US1] Drop and recreate policies on `reservation_rooms` — SELECT staff, INSERT writers, UPDATE writers (with terminal state subquery), DELETE admin — in migration file
- [X] T023 [P] [US1] Drop and recreate policies on `reservation_guests` — SELECT staff, INSERT writers, UPDATE writers, DELETE admin — in migration file
- [X] T024 [P] [US1] Drop and recreate policies on `reservation_company_info` — SELECT staff, INSERT writers, UPDATE writers (with company_credit_override guard), DELETE admin — in migration file
- [X] T025 [P] [US1] Drop and recreate policies on `reservation_holds` — SELECT staff, INSERT writers, UPDATE writers, DELETE admin — in migration file
- [X] T026 [P] [US1] Drop and recreate policies on `reservation_status_history` — SELECT staff, INSERT writers only (append-only) — in migration file
- [X] T027 [P] [US1] Drop and recreate policies on `room_status_history` — SELECT staff, INSERT writers only (append-only) — in migration file

### US1 Verification Script

- [X] T028 [US1] Create US1 verification script at `specs/006-rls-and-security/tests/test_us1_rbac_basics.sql` — test INSERT/ SELECT/UPDATE/DELETE for front_desk, accountant, admin roles against reservations table

**Checkpoint**: US1 fully functional. Front desk and accountant access correctly restricted.

---

## Phase 4: User Story 2 — Field-Level & State-Based Security (Priority: P2)

**Goal**: Sensitive columns (pricing, internal_notes, guarantee) protected by role. Terminal state (checked_out/cancelled/no_show) blocks child-table modifications.

**Independent Test**: Front desk UPDATE on pricing column fails. Any role UPDATE on checked_out reservation_rooms fails. Admin UPDATE on internal_notes succeeds. No-show billing insert succeeds (system-level bypass).

### Column-Level Policies for US2

- [X] T029 [P] [US2] Drop and recreate policies on `reservation_pricing_items` — SELECT staff, INSERT writers (blocked if parent terminal), UPDATE amounts requires `can_override_pricing()` (description-only allowed for writers), DELETE admin — in migration file
- [X] T030 [P] [US2] Drop and recreate policies on `reservation_payments` — SELECT staff, INSERT for `record_payment` (writers), INSERT for refunds requires `can_refund_payment()`, UPDATE blocked (append-only), DELETE admin — in migration file
- [X] T031 [P] [US2] Drop and recreate policies on `reservation_notes` — SELECT staff, INSERT writers, UPDATE writers (is_internal flagged notes require `can_manage_internal_notes()`), DELETE admin — in migration file

### Terminal State Protection for US2

- [X] T032 [P] [US2] Add terminal state subquery to reservation_rooms INSERT and UPDATE WITH CHECK — block when parent status IN ('checked_out', 'cancelled', 'no_show') — in migration file
- [X] T033 [P] [US2] Add terminal state subquery to reservation_pricing_items INSERT WITH CHECK — block new charges on terminal reservations — in migration file
- [X] T034 [P] [US2] Add terminal state subquery to reservation_payments INSERT WITH CHECK — block new payments (not refunds) on terminal reservations — in migration file

### US2 Verification Script

- [X] T035 [US2] Create US2 verification script at `specs/006-rls-and-security/tests/test_us2_field_level.sql` — test pricing column override, internal_notes write, terminal state blocks, no-show billing scenario

**Checkpoint**: US2 complete. Sensitive columns and terminal states protected.

---

## Phase 5: User Story 3 — RLS Verification & Audit (Priority: P3)

**Goal**: Automated verification that RLS is enabled on all tables, policies exist per operation, and audit logging captures mutations.

**Independent Test**: Query `pg_tables` confirms 9 tables with RLS enabled. Query `pg_policies` confirms 3-4 policies per table. Perform a mutation and verify audit_log entry.

### Verification Infrastructure for US3

- [X] T036 [P] [US3] Create RLS verification script at `specs/006-rls-and-security/tests/test_us3_rls_enabled.sql` — query `pg_tables` for `rowsecurity = true` on all 9 reservation tables
- [X] T037 [P] [US3] Create policy count verification script at `specs/006-rls-and-security/tests/test_us3_policy_coverage.sql` — query `pg_policies` grouped by table, verify minimum policy counts
- [X] T038 [P] [US3] Create auth failure test script at `specs/006-rls-and-security/tests/test_us3_auth_failure.sql` — verify unauthenticated (anon) user gets empty results on reservation tables
- [X] T039 [P] [US3] Create audit verification script at `specs/006-rls-and-security/tests/test_us3_audit_log.sql` — perform a mutation as authenticated user, verify audit_log entry exists with correct action/actor/target
- [X] T040 [P] [US3] Create JWT role missing test script at `specs/006-rls-and-security/tests/test_us3_jwt_missing_role.sql` — verify `current_app_role()` returns NULL and policies fail closed
- [X] T041 [P] [US3] Create comprehensive test runner at `specs/006-rls-and-security/tests/run_all.sh` or `run_all.ps1` — iterates all test scripts and reports PASS/FAIL per scenario

### Audit Walkthrough for US3

- [X] T042 [US3] Document audit logging contract in `specs/006-rls-and-security/contracts/audit-logging.md` — verify it matches implemented log_action values and audit_log entry format (review existing)

**Checkpoint**: US3 complete. All verification scripts pass. Audit captures mutations correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final assembly, end-to-end validation, and documentation

- [X] T043 Assemble complete migration at `supabase/migrations/20260628000002_refine_reservation_rls.sql` — verify correct ordering (helpers first, then policy drops, then policy creates, then RPC updates)
- [X] T044 Run all test scripts via `specs/006-rls-and-security/tests/run_all.ps1` or through Supabase SQL editor — confirm all scenarios PASS
- [X] T045 Test migration idempotency — re-run migration, verify no errors from `DROP IF EXISTS` / `CREATE IF NOT EXISTS` / `CREATE OR REPLACE`
- [X] T046 [P] Update `specs/006-rls-and-security/quickstart.md` with any corrections discovered during testing
- [X] T047 [P] Update `specs/006-rls-and-security/contracts/` with any corrections discovered during implementation
- [X] T048 Review constitution compliance — confirm all gates still pass (no violations introduced by migration)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately (review-only)
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational completion — core RBAC must exist before column-level or terminal-state
- **US2 (Phase 4)**: Depends on US1 completion — column-level policies build on RBAC base
- **US3 (Phase 5)**: Can start after US1 — verification scripts reference US1+US2 policies
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Start after Foundational — No dependencies on other stories 🎯 MVP
- **User Story 2 (P2)**: Start after US1 — requires US1 RBAC base
- **User Story 3 (P3)**: Start after US1 — verification references US1+US2 policies

### Within Each Phase

- Helper functions marked [P] can be written in any order
- Policy tasks for different tables marked [P] can run in parallel (different tables)
- RPC guards marked [P] can run in parallel (different functions)
- Verification scripts marked [P] can run in parallel (different SQL files)

### Parallel Opportunities

- T002-T004: Review existing schema (all parallel)
- T006-T011: Create all 6 new helper functions (all parallel)
- T012-T016: Add RPC permission guards (all parallel)
- T017-T027: US1 policy work — reservations table must be sequential (T017→T018→T019→T020); different tables are parallel
- T029-T034: US2 policy work — pricing_items, payments, notes (all parallel)
- T036-T041: US3 verification scripts (all parallel)
- T046-T047: Documentation fixes (parallel)

---

## Parallel Example: User Story 1

```bash
# Launch all RPC guard tasks together:
Task: "Add permission guard to cancel_reservation in migration file" [T012]
Task: "Add permission guard to check_in in migration file" [T013]
Task: "Add permission guard to check_out in migration file" [T014]
Task: "Add permission guard to confirm_reservation in migration file" [T015]
Task: "Add permission guard to get_room_availability in migration file" [T016]

# Launch all table policy tasks together (different tables, no conflicts):
Task: "Create refined policies for reservation_rooms" [T022]
Task: "Create refined policies for reservation_guests" [T023]
Task: "Create refined policies for reservation_company_info" [T024]
Task: "Create refined policies for reservation_holds" [T025]
Task: "Create refined policies for reservation_status_history" [T026]
Task: "Create refined policies for room_status_history" [T027]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (review existing schema)
2. Complete Phase 2: Foundational (create 6 helper functions)
3. Complete Phase 3: User Story 1 (RBAC on all 9 tables + RPC guards)
4. **STOP and VALIDATE**: Run US1 verification script — front_desk correctly restricted, accountant read-only, admin full access
5. MVP delivered: coarse RLS replaced with fine-grained RBAC

### Incremental Delivery

1. Setup + Foundational → Helper functions created
2. Add User Story 1 → RBAC on all tables → Deploy/Demo (MVP!)
3. Add User Story 2 → Column-level + terminal state → Deploy/Demo
4. Add User Story 3 → Verification + audit → Deploy/Demo
5. Polish → Final validation → Deploy/Demo

### Parallel Team Strategy

With multiple developers:

1. One developer: Phases 1–2 (review + helpers)
2. Once helpers are done:
   - Developer A: US1 — reservation policies (T017-T021)
   - Developer B: US1 — child table policies (T022-T027)
   - Developer C: RPC guards (T012-T016)
3. Assemble into single migration file at end

---

## Notes

- [P] tasks = different tables, functions, or files — no conflicts
- [Story] label maps task to specific user story
- Each user story is independently verifiable via its test script
- All policy work writes to a single migration file — coordinate merges carefully
- Commit after each phase or logical task group
- Stop at each checkpoint to validate independently
- Run migration through Supabase Dashboard SQL editor or `supabase db push` for local dev




