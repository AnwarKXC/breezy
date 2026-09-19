# Feature Specification: MCP Verification Queries

**Feature Branch**: `015-mcp-verification-queries`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Phase 16 — MCP Verification Queriess from d:\ai-practise\hotel-system\docs\plans\reservation_model_supabase_mcp_plan.md"

## Clarifications

### Session 2026-06-28

- Q: What format should the MCP verification query catalog be delivered in? → A: Markdown document with SQL blocks in code fences, each prefaced with purpose, expected result, and MCP tool name.

## User Scenarios & Testing

### User Story 1 — Schema Verification via MCP (Priority: P1)

An administrator uses Supabase MCP inspection tools to verify that all reservation model tables exist with correct columns, foreign keys, and constraints. This provides a first-pass confirmation that the migration was applied successfully and no schema elements are missing.

**Why this priority**: Table existence is the most fundamental check — if tables are missing, everything else fails. This verification catches the highest-impact migration failures immediately.

**Independent Test**: Run the table existence query via MCP — all 9 reservation tables plus `room_status_history` are confirmed present with at least the columns listed in the schema design.

**Acceptance Scenarios**:

1. **Given** a database with all migrations applied, **When** the table existence query runs via MCP, **Then** `reservations`, `reservation_rooms`, `reservation_guests`, `reservation_company_info`, `reservation_pricing_items`, `reservation_payments`, `reservation_holds`, `reservation_notes`, `reservation_status_history`, and `room_status_history` are all confirmed present.
2. **Given** the tables exist, **When** column inspection queries run via MCP, **Then** key columns in each table have the correct data types — `reservations.status` is an enum or text with constrained values, `reservation_rooms.check_in_date` is `date`, `reservation_payments.amount` is `numeric`.
3. **Given** the tables exist, **When** constraint queries run via MCP, **Then** check constraints exist for date ordering (`check_out_date > check_in_date`), positive values (`nights > 0`), and non-negative amounts.

---

### User Story 2 — Data Integrity Verification (Priority: P2)

An administrator runs verification queries via MCP to confirm that existing data adheres to business rules — no overlapping active room reservations, holds have valid expiry timestamps in the future, and reservation payment totals match the sum of their payments.

**Why this priority**: Data integrity violations (overlapping bookings, mismatched balances) are silent data corruption that undermines the entire system. Catching them early prevents guest-facing issues.

**Independent Test**: Run each integrity query via MCP — no overlapping active rooms are found, no active holds have past expiry dates, and reservation balance equals total minus paid within acceptable rounding.

**Acceptance Scenarios**:

1. **Given** seed data with no overlapping bookings, **When** the room conflict query runs via MCP, **Then** zero overlapping active room reservations are returned (no two rows share a room with overlapping dates and active status).
2. **Given** seed data holds with future expiry dates, **When** the active holds query runs, **Then** all holds with `status = 'active'` have `expires_at > now()`.
3. **Given** seed data reservations with calculated amounts, **When** the payment balance query runs, **Then** for each reservation, `balance_amount` equals `total_amount - paid_amount` (within rounding tolerance).
4. **Given** seed data company reservations, **When** the company query runs, **Then** each company booking has a matching row in `reservation_company_info` with the correct company reference.

---

### User Story 3 — Business Scenario Validation (Priority: P3)

An administrator runs complex join queries via MCP that validate end-to-end business scenarios — showing which rooms are occupied now, which reservations are due out today, and which companies have active bookings. These queries prove the data model supports real front-desk operations.

**Why this priority**: While schema and integrity checks confirm technical correctness, business scenario queries validate that the model actually answers the operational questions front desk staff need — proving the design from a user perspective.

**Independent Test**: Run each business query via MCP — the occupied rooms query returns the correct count, the due-out query correctly identifies rooms checking out today, and the company query lists all companies with active reservations.

**Acceptance Scenarios**:

1. **Given** seed data with one checked-in reservation (RSV-SEED-001), **When** the occupied rooms query runs, **Then** exactly one room is returned as currently occupied with the reservation number and guest name.
2. **Given** seed data with no reservations checking out today, **When** the due-out query runs, **Then** zero rooms are returned (or the correct count if dates align).
3. **Given** seed data with one company booking (RSV-SEED-003), **When** the company reservations query runs, **Then** at least one company reservation is returned with the company name, reservation number, and status.
4. **Given** seed data with multiple booking types, **When** the booking type breakdown query runs, **Then** at least one individual and one company booking are distinguishable in the results.

### Edge Cases

- What happens when a verification query returns an unexpected empty result — does MCP surface an error or simply show zero rows?
- What if the database connection is temporarily unavailable during verification — how should the administrator retry?
- How does the verifier distinguish between "no data" (expected empty result) and "query failed silently" (error suppressed)?
- What if seed data dates have become stale (e.g., checked-in reservation's dates are in the past because the database was seeded months ago)?

## Requirements

### Functional Requirements

- **FR-001**: Verification queries MUST confirm all 10 reservation model tables exist in the `public` schema: `reservations`, `reservation_rooms`, `reservation_guests`, `reservation_company_info`, `reservation_pricing_items`, `reservation_payments`, `reservation_holds`, `reservation_notes`, `reservation_status_history`, `room_status_history`.
- **FR-002**: Verification queries MUST confirm key columns in each table have the correct data types (date columns are `date`, amount columns are `numeric`, status columns use the defined enum or constrained text).
- **FR-003**: Verification queries MUST confirm critical check constraints exist: `check_out_date > check_in_date` on reservations, `nights > 0`, `amount > 0` on payments, non-negative amount constraints.
- **FR-004**: A room conflict query MUST return zero rows when run against a correctly seeded database (no overlapping active room reservations).
- **FR-005**: An active holds query MUST confirm all holds with `status = 'active'` have `expires_at > now()`.
- **FR-006**: A payment balance query MUST confirm for each reservation that `balance_amount = total_amount - paid_amount` within acceptable rounding tolerance.
- **FR-007**: A company reservations query MUST join `reservations` with `reservation_company_info` and return each company booking with the company name and reservation status.
- **FR-008**: An occupied rooms query MUST return rooms where `reservation_rooms.status = 'occupied'` or the parent reservation `status = 'checked_in'`, along with reservation number and guest name.
- **FR-009**: A due-out query MUST identify rooms checking out today by joining reservations with reservation rooms on `check_out_date = CURRENT_DATE`.
- **FR-010**: A booking type breakdown query MUST group reservations by `booking_type` and return the count per type.
- **FR-011**: Each verification query MUST include a brief comment explaining the expected result, so the administrator knows what outcome indicates success.
- **FR-012**: Verification queries MUST be documented with the Supabase MCP tool name needed to execute each query.

### Key Entities

- **MCP Verification Query**: A SQL query documented with purpose, expected result, and the MCP tool to invoke it (e.g., `supabase_execute_sql`). Each query targets a specific verification concern.
- **Query Catalog**: A markdown document containing SQL queries in code fences, organized by category (schema, data integrity, business scenarios). Each query block is prefaced with its purpose, expected result, and the MCP tool to invoke.
- **Verification Report**: The raw output from MCP queries, interpreted by the administrator to confirm the migration is correct.

## Success Criteria

### Measurable Outcomes

- **SC-001**: An administrator can run all schema verification queries via MCP in under 2 minutes and confirm all 10 tables exist.
- **SC-002**: All data integrity queries return expected results (zero conflicts, correct balances) within 10 seconds each when run via MCP.
- **SC-003**: All business scenario queries return non-empty, meaningful results that match seed data expectations.
- **SC-004**: Each verification query includes a comment with the expected result, and 100% of queries have a clear pass/fail interpretation.

## Assumptions

- The reservation model schema and seed data migrations (from Phase 15) have already been applied to the target database.
- Supabase MCP server is connected and available — the `supabase_execute_sql` tool functions.
- Verification queries are run by an administrator with access to the Supabase project and MCP tools.
- Verification queries are read-only — they do not modify any data.
- Seed data loaded during Phase 15 may have dates relative to `CURRENT_DATE`, so business queries should use relative date comparisons where possible.
- This feature documents the queries to run; it does not build an automated verification system or CI/CD integration.
