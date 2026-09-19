---

description: "Task list for MCP verification queries — markdown query catalog"
---

# Tasks: MCP Verification Queries

**Input**: Design documents from `/specs/015-mcp-verification-queries/`

**Prerequisites**: plan.md, spec.md (3 user stories), research.md, data-model.md, quickstart.md

**Tests**: No separate test tasks — validation is manual MCP execution (T004).

**Organization**: Tasks are grouped by user story, each contributing sections to the single query catalog file.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1=schema, US2=integrity, US3=business)
- Include exact file paths in descriptions

## Path Conventions

- **Query catalog**: `supabase/migrations/scripts/mcp-verification-queries.md`

---

## Phase 1: User Story 1 — Schema Verification Queries (Priority: P1) 🎯 MVP

**Goal**: Write the Schema Verification section of the query catalog with 6 queries confirming all reservation tables, columns, constraints, foreign keys, indexes, and RLS exist.

**Independent Test**: Administrator copies query 1 (table existence) into `supabase_execute_sql` via MCP — all 10 tables confirmed present.

### Implementation for User Story 1

- [x] T001 [US1] Write Schema Verification section in `supabase/migrations/scripts/mcp-verification-queries.md` per research.md query pattern with 6 queries:
  - Query 1: Table existence (`information_schema.tables` — 10 tables) per FR-001
  - Query 2: Column data types (`information_schema.columns` — date/numeric/enum columns correct) per FR-002
  - Query 3: Check constraints (`information_schema.check_constraints` — date ordering, positive values) per FR-003
  - Query 4: Foreign keys (`information_schema.table_constraints` — FKs to rooms, guests, contacts) per FR-001
  - Query 5: Index existence (`pg_indexes` — ≥15 reservation indexes) per plan
  - Query 6: RLS status (`pg_tables` + `pg_policies` — all 10 tables RLS-enabled) per plan
  - Each query includes: MCP tool name (`supabase_execute_sql`), category label, purpose, expected result per FR-011/FR-012

**Checkpoint**: Schema section complete — administrator can verify migration was applied.

---

## Phase 2: User Story 2 — Data Integrity Queries (Priority: P2)

**Goal**: Write the Data Integrity section with 4 queries verifying no room conflicts, valid holds, correct payment balances, and company references.

**Independent Test**: Administrator runs room conflict query (query 7) via MCP — zero overlapping active rooms returned.

### Implementation for User Story 2

- [x] T002 [US2] Write Data Integrity section in `supabase/migrations/scripts/mcp-verification-queries.md` with 4 queries:
  - Query 7: Room conflicts — select `reservation_rooms` where active statuses overlap dates per FR-004
  - Query 8: Active holds — confirm all active holds have `expires_at > now()` per FR-005
  - Query 9: Payment balance — verify `balance_amount = total_amount - paid_amount` per FR-006
  - Query 10: Company references — JOIN `reservations` + `reservation_company_info` to confirm each company booking has company row per FR-007
  - Each query follows same format as Phase 1 (purpose, expected result, MCP tool)

**Checkpoint**: Integrity section complete — data quality verified.

---

## Phase 3: User Story 3 — Business Scenario Queries (Priority: P3)

**Goal**: Write the Business Scenarios section with 5 queries proving the model answers real front desk operational questions.

**Independent Test**: Administrator runs occupied rooms query via MCP — RSV-SEED-001 with Ahmed Ali returned.

### Implementation for User Story 3

- [x] T003 [US3] Write Business Scenarios section in `supabase/migrations/scripts/mcp-verification-queries.md` with 5 queries:
  - Query 11: Occupied rooms — JOIN `reservation_rooms` + `reservations` + `guests` for currently occupied rooms per FR-008
  - Query 12: Due-out today — rooms checking out `CURRENT_DATE` per FR-009
  - Query 13: Company reservations — full company booking detail JOIN per spec US3 scenario 3
  - Query 14: Booking type breakdown — `GROUP BY booking_type` with counts per FR-010
  - Query 15: Reservation summary — all seed reservations with status, dates, guest/company per spec US3 scenario 4
  - Each query follows same format as Phase 1

**Checkpoint**: Business section complete — model proven end-to-end.

---

## Phase 4: Polish & Validation

**Purpose**: Run queries via MCP to confirm they produce expected results

- [x] T004 Run all 15 queries via `supabase_execute_sql` MCP tool against the development database — confirm each query output matches its expected result per quickstart.md, update any queries that fail to produce expected output

---

## Dependencies & Execution Order

### Phase Dependencies

- **US1 Schema (Phase 1)**: No dependencies — references existing schema only
- **US2 Integrity (Phase 2)**: No dependency on T001 (different queries, same file)
- **US3 Business (Phase 3)**: No dependency on T001 or T002 (different queries, same file)
- **Polish (Phase 4)**: Depends on T001, T002, T003 completion

### User Story Dependencies

- **US1 (P1)**: Independent
- **US2 (P2)**: Independent of US1
- **US3 (P3)**: Independent of US1 and US2

All three user stories are independent — they contribute sections to the same file but operate on different query categories with no shared logic.

### Within Each Phase

- Phase 1: Single task (T001) — 6 queries in one file section
- Phase 2: Single task (T002) — 4 queries in one file section
- Phase 3: Single task (T003) — 5 queries in one file section

### Parallel Opportunities

- None — all tasks write to the same file (`mcp-verification-queries.md`). Sequential execution prevents merge conflicts.
- If parallel execution is needed, each section can be written to a separate fragment file and merged in T004.

### Sequential Approach

```bash
Task: "T001 [US1] Write schema verification queries (1-6)"
Task: "T002 [US2] Write data integrity queries (7-10)"
Task: "T003 [US3] Write business scenario queries (11-15)"
Task: "T004 Validate all queries via MCP"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: T001 (schema queries 1-6)
2. **STOP and VALIDATE**: Run query 1 via MCP → all 10 tables confirmed
3. MVP delivered: Schema verified — migration applied correctly

### Incremental Delivery

1. US1 (T001) — Schema verification (MVP)
2. US2 (T002) — Data integrity
3. US3 (T003) — Business scenarios
4. US4 (T004) — Full validation via MCP

---

## Notes

- All queries write to single file `supabase/migrations/scripts/mcp-verification-queries.md`
- Each query block follows research.md pattern: purpose header, MCP tool reference, expected result comment, fenced SQL
- Queries are read-only — safe to run on any environment
- Seed data dates use `CURRENT_DATE` relative expressions — queries should use date comparisons not absolute dates
- Existing `supabase/migrations/scripts/` directory created in Phase 15 (014-migration-rollout-plans T001)
