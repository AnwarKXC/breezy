# Tasks: Existing Code and Database Audit

**Input**: Design documents from `/specs/003-code-database-audit/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not applicable â€” this is a documentation/analysis phase, not a feature implementation.

**Organization**: Tasks are grouped by user story (all P1) with sequential and parallel dependencies noted.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Findings output**: `specs/003-code-database-audit/findings/`
- **Contracts reference**: `specs/003-code-database-audit/contracts/`
- **Source inspected**: `src/modules/*`, `src/config/*`, `src/app/api/*`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the findings directory and verify prerequisites for the audit.

- [X] T001 Create `findings/` directory under `specs/003-code-database-audit/` and verify Supabase MCP/CLI tool availability

---

## Phase 2: User Story 1 - Code Module Inventory (Priority: P1) ðŸŽ¯

**Goal**: Produce a documented inventory of all 10 reservation-related code module areas, documenting each module's purpose, exported types/interfaces, key functions, and current limitations.

**Independent Test**: `findings/code-inventory.md` exists with entries for all 10 module areas.

- [X] T002 [P] [US1] Inspect `src/modules/bookings/` â€” document exported types, interfaces, key functions, and limitations per `contracts/code-inventory-format.md`
- [X] T003 [P] [US1] Inspect `src/modules/rooms/` â€” document exported types, interfaces, key functions, and limitations per `contracts/code-inventory-format.md`
- [X] T004 [P] [US1] Inspect `src/modules/room-types/` â€” document exported types, interfaces, key functions, and limitations per `contracts/code-inventory-format.md`
- [X] T005 [P] [US1] Inspect `src/modules/guests/` â€” document exported types, interfaces, key functions, and limitations per `contracts/code-inventory-format.md`
- [X] T006 [P] [US1] Inspect `src/modules/contacts/` â€” document exported types, interfaces, key functions, and limitations per `contracts/code-inventory-format.md`
- [X] T007 [P] [US1] Inspect `src/modules/pricing/` â€” document exported types, interfaces, key functions, and limitations per `contracts/code-inventory-format.md`
- [X] T008 [P] [US1] Inspect `src/modules/accounting/` â€” document exported types, interfaces, key functions, and limitations per `contracts/code-inventory-format.md`
- [X] T009 [P] [US1] Inspect `src/modules/logs/` â€” document exported types, interfaces, key functions, and limitations per `contracts/code-inventory-format.md`
- [X] T010 [P] [US1] Inspect `src/config/permissions.ts` and `src/config/actionPermissions.ts` â€” document existing permission actions, missing actions, and extensibility assessment
- [X] T011 [US1] Compile all module findings into `findings/code-inventory.md` â€” 10 module entries plus permissions assessment, cross-referencing against target reservation model entities

**Checkpoint**: Code inventory complete â€” all 10 module areas documented in `findings/code-inventory.md`

---

## Phase 3: User Story 2 - Database Schema Inspection (Priority: P1)

**Goal**: Inspect the live Supabase/Postgres database to document existing tables, columns, types, constraints, foreign keys, indexes, RLS policies, functions, and migrations using MCP (primary), CLI (fallback), or direct SQL (last resort).

**Independent Test**: `findings/database-findings.md` exists with table inventory, relationship map, and RLS policy summary.

- [X] T012 [P] [US2] Use Supabase MCP (or fallback) to list all tables in the database â€” capture table names, columns, types, nullability, defaults, and constraints
- [X] T013 [P] [US2] Use Supabase MCP (or fallback) to inspect foreign key relationships between bookings, rooms, guests, contacts, and pricing tables
- [X] T014 [P] [US2] Use Supabase MCP (or fallback) to list and document RLS policies on booking and room tables â€” identify whether `auth.uid()`, profiles, custom roles, or service-role pattern is used
- [X] T015 [P] [US2] Use Supabase MCP (or fallback) to list database functions/RPCs and existing migrations relevant to the reservation domain
- [X] T016 [P] [US2] Inspect `src/app/api/bookings/` and `src/app/api/rooms/` routes â€” document existing API endpoints and their patterns
- [X] T017 [US2] Compile all database findings into `findings/database-findings.md` â€” table inventory, relationship map, RLS summary, migration history, API route inventory

**Checkpoint**: Database inspection complete â€” schema, relationships, RLS, and API routes documented in `findings/database-findings.md`

---

## Phase 4: User Story 3 - Reuse/Extend Decision Report (Priority: P1)

**Goal**: Based on code inventory and database findings, produce explicit reuse/extend/create decisions for all 9 target reservation entities, a migration impact list, and a risk assessment.

**Independent Test**: `findings/reuse-extend-decisions.md` exists with decisions for all 9 entities, `findings/migration-impact-list.md` exists with ordered changes, `findings/risk-assessment.md` exists with identified issues.

**âš ï¸ Depends on**: Phase 2 (US1) and Phase 3 (US2) must be complete â€” this phase synthesizes both.

- [X] T018 [P] [US3] Analyze `reservations` entity â€” determine if `bookings` table can serve as parent or if new `reservations` table is needed; document decision in `findings/reuse-extend-decisions.md`
- [X] T019 [P] [US3] Analyze `reservation_rooms` entity â€” determine if a corresponding table exists; document decision in `findings/reuse-extend-decisions.md`
- [X] T020 [P] [US3] Analyze `reservation_guests` entity â€” determine if a corresponding table exists; document decision in `findings/reuse-extend-decisions.md`
- [X] T021 [P] [US3] Analyze `reservation_company_info` entity â€” determine if a corresponding table exists; document decision in `findings/reuse-extend-decisions.md`
- [X] T022 [P] [US3] Analyze `reservation_pricing_items` entity â€” determine if a corresponding table exists; document decision in `findings/reuse-extend-decisions.md`
- [X] T023 [P] [US3] Analyze `reservation_payments` entity â€” determine if a corresponding table exists; document decision in `findings/reuse-extend-decisions.md`
- [X] T024 [P] [US3] Analyze `reservation_holds` entity â€” determine if a corresponding table exists; document decision in `findings/reuse-extend-decisions.md`
- [X] T025 [P] [US3] Analyze `reservation_notes` entity â€” determine if a corresponding table exists; document decision in `findings/reuse-extend-decisions.md`
- [X] T026 [P] [US3] Analyze `reservation_status_history` entity â€” determine if a corresponding table exists; document decision in `findings/reuse-extend-decisions.md`
- [X] T027 [US3] Compile migration impact list into `findings/migration-impact-list.md` â€” ordered by dependency (table creation â†’ column additions â†’ indexes â†’ constraints â†’ RLS changes)
- [X] T028 [US3] Compile risk assessment into `findings/risk-assessment.md` â€” document incomplete modules, schema/type mismatches, missing RLS/permissions, missing constraints/indexes, architecture concerns

**Checkpoint**: All 9 entities have documented decisions, migration changes enumerated, and risks identified.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all deliverables.

- [X] T029 Verify all 5 findings files exist: `code-inventory.md`, `database-findings.md`, `reuse-extend-decisions.md`, `migration-impact-list.md`, `risk-assessment.md`
- [X] T030 Verify no duplicate model is introduced without written justification (FR-010) â€” scan all decisions
- [X] T031 Verify all decisions include rationale â€” no orphan "Create" decisions without justification
- [X] T032 Run quickstart validation checklist: 7 items from `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies â€” can start immediately
- **User Story 1 - Code Inventory (Phase 2)**: Depends on Setup completion
- **User Story 2 - DB Inspection (Phase 3)**: Depends on Setup completion
- **User Story 3 - Decisions (Phase 4)**: Depends on BOTH Phase 2 AND Phase 3 completion
- **Polish (Phase 5)**: Depends on Phase 4 completion

### User Story Dependencies

- **US1 (Code Module Inventory)**: No dependencies on other stories â€” can start after setup
- **US2 (Database Schema Inspection)**: No dependencies on other stories â€” can start after setup
- **US3 (Reuse/Extend Decision Report)**: Depends on US1 + US2 findings â€” MUST wait for both

### Within Each User Story

- All per-module/entity inspection tasks marked [P] can run in parallel
- Compilation tasks (T011, T017) MUST wait for all parallel inspections in their story to complete
- Entity analyses (T018-T026) for US3 can all run in parallel since they're independent

### Parallel Opportunities

- T002-T010: All 9 module inspection tasks can run in parallel
- T012-T016: All 5 database/API inspection tasks can run in parallel
- T018-T026: All 9 entity analysis tasks can run in parallel
- US2 and US3: Cannot run in parallel (US3 depends on US2 findings)

---

## Parallel Example: User Story 1

```bash
# Launch all module inspections in parallel:
Task: "Inspect bookings module"
Task: "Inspect rooms module"
Task: "Inspect room-types module"
Task: "Inspect guests module"
Task: "Inspect contacts module"
Task: "Inspect pricing module"
Task: "Inspect accounting module"
Task: "Inspect logs module"
Task: "Inspect permissions config"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: US1 - Code Module Inventory (parallel inspection, then compile)
3. Complete Phase 3: US2 - Database Schema Inspection (parallel tasks, then compile)
4. **STOP and VALIDATE**: Code inventory + DB findings must be complete before decisions

### Incremental Delivery

1. Setup + Code Inventory + DB Inspection â†’ Foundation for decisions
2. Add Reuse/Extend Decisions â†’ Migration impact + risk assessment complete
3. Polish â†’ Final review and validation

### Parallel Team Strategy

With a single developer (LLM):
1. Run Phase 2 [P] tasks in parallel batches (all module inspections)
2. Compile US1 findings
3. Run Phase 3 [P] tasks in parallel (all DB inspection tasks)
4. Compile US2 findings
5. Run Phase 4 [P] tasks in parallel (all entity analyses)
6. Compile US3 reports (migration impact + risk assessment)
7. Final validation

