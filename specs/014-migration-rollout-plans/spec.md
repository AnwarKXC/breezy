# Feature Specification: Migration Rollout Plans

**Feature Branch**: `014-migration-rollout-plans`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Phase 15 — Migration Rollout Plans from d:\ai-practise\hotel-system\docs\plans\reservation_model_supabase_mcp_plan.md"

## Clarifications

### Session 2026-06-28

- Q: Which hold expiry mechanism should be used? → A: Supabase cron (pg_cron) — SQL-based scheduled job for in-database atomic cleanup.
- Q: How should verification results be captured? → A: Standalone SQL verification script with `[PASS]` / `[FAIL]` labels per check, runnable via psql or Supabase dashboard.

## User Scenarios & Testing

### User Story 1 — Seed Data Migration for Development (Priority: P1)

A developer can apply a seed data migration that populates the development database with sample rooms, room types, guests, companies, and realistic reservation scenarios (walk-in, future booking, checked-in, due-out, maintenance, dirty). This enables local development, frontend testing, and integration tests without manually creating data.

**Why this priority**: Without sample data, every developer and tester must manually create rooms, guests, and reservations before they can develop or test any feature. This blocks all downstream development velocity.

**Independent Test**: Run `supabase db reset` (which disables `realtime` if using `--no-verify` equivalent) then query `rooms` and `room_types` tables — at least 10 rooms across 3+ room types are populated with realistic data; at least 3 reservations covering different statuses and booking types exist.

**Acceptance Scenarios**:

1. **Given** a freshly reset development database, **When** the seed migration is applied, **Then** at least 10 rooms across 3+ room types exist with realistic names, prices, and floor assignments.
2. **Given** a freshly seeded database, **When** the seed migration is applied, **Then** at least one individual guest record exists with name, phone, and email.
3. **Given** a freshly seeded database, **When** the seed migration is applied, **Then** at least one company contact exists with company details and a price override applied to a room type.
4. **Given** a freshly seeded database, **When** the seed migration is applied, **Then** at least 3 reservations exist covering different statuses (e.g., confirmed, checked_in, checked_out) and different booking types (individual, company).
5. **Given** a freshly seeded database, **When** the seed migration is applied, **Then** at least one room is in maintenance status and one room is marked dirty.
6. **Given** a freshly seeded database, **When** the seed migration is applied, **Then** at least one reservation has a future check-in date and one reservation has a check-in date in the past.

---

### User Story 2 — Migration Verification with MCP (Priority: P2)

An administrator can run a set of verification queries against the database after all migrations are applied to confirm that tables, columns, constraints, indexes, RLS policies, RPC functions, and seed data all exist and function correctly. This provides confidence that the rollout completed successfully before enabling the feature in production.

**Why this priority**: Rolling out schema changes without verification risks undetected failures — missing indexes cause slow queries, missing RLS exposes data, missing seed data blocks development. Automated verification catches these issues before they impact users or developers.

**Independent Test**: Run a verification script or execute the verification queries manually — all queries return expected results (tables exist, indexes exist, RLS policies exist, RPCs can be called, seed data returns correct counts).

**Acceptance Scenarios**:

1. **Given** a database with all migrations applied, **When** table existence queries are run, **Then** all 10 reservation model tables (reservations, reservation_rooms, reservation_guests, reservation_company_info, reservation_pricing_items, reservation_payments, reservation_holds, reservation_notes, reservation_status_history, room_status_history) are confirmed present.
2. **Given** a database with all migrations applied, **When** index existence queries are run, **Then** at least 15 indexes across the reservation tables are confirmed present.
3. **Given** a database with all migrations applied, **When** RLS policy queries are run, **Then** all 10 reservation tables have RLS enabled and appropriate SELECT/INSERT/UPDATE/DELETE policies.
4. **Given** a database with all migrations applied, **When** RPC function queries are run, **Then** the `get_room_availability`, `confirm_reservation`, and `cancel_reservation` functions exist and can be described.
5. **Given** a database with seed data applied, **When** seed data count queries are run, **Then** the number of rooms, guests, companies, and reservations matches expected counts from the seed migration.

---

### User Story 3 — Hold Expiry Cleanup Mechanism (Priority: P3)

The system automatically expires stale room holds after their configured expiry period so that abandoned holds do not permanently block room availability. This ensures that holds created but never confirmed or released are cleaned up automatically.

**Why this priority**: Room holds that are never released (e.g., due to browser closure, session timeout, or user error) permanently block the room from being booked by any other guest. An automatic expiry mechanism is essential for a production hotel system.

**Independent Test**: Create an active hold with a 1-minute expiry, wait for the expiry to pass, then trigger the cleanup (or wait for the scheduled job to run) — the hold status changes to `expired` and the room becomes available for booking.

**Acceptance Scenarios**:

1. **Given** an active hold past its `expires_at` timestamp, **When** the cleanup mechanism runs, **Then** the hold status is changed to `expired`.
2. **Given** an expired hold, **When** an availability check is performed for the same room and dates, **Then** the room is shown as available (expired holds do not block availability).
3. **Given** the expiry cleanup runs, **When** it processes holds, **Then** only holds with `status = 'active'` and `expires_at < now()` are affected — active holds that have not expired are left untouched.
4. **Given** the expiry cleanup runs, **When** a hold is expired, **Then** an audit log entry is written recording the hold expiry event.

### Edge Cases

- What happens when a hold was created with a very short expiry (e.g., 1 minute) and the cleanup job runs infrequently?
- How does the system behave when the cleanup job and a confirmation RPC attempt to process the same hold simultaneously?
- What if the seed data migration runs on a production database that already has data — will it fail or duplicate?
- How does the system report when a verification query fails — does it surface the specific failure?

## Requirements

### Functional Requirements

- **FR-001**: A seed data migration MUST create at least 10 rooms across at least 3 distinct room types with realistic room numbers, floor assignments, base prices, and capacity.
- **FR-002**: A seed data migration MUST create at least one individual guest record with name, phone, email, and ID/passport number.
- **FR-003**: A seed data migration MUST create at least one company contact with company details.
- **FR-004**: A seed data migration MUST create at least one company price override applied to a room type.
- **FR-005**: A seed data migration MUST create at least 3 reservations: one checked_in (past check-in, future check-out), one checked_out (past), and one confirmed (future).
- **FR-006**: A seed data migration MUST set at least one room to maintenance status.
- **FR-007**: A seed data migration MUST set at least one room to dirty status.
- **FR-008**: Verification queries MUST confirm all 10 reservation tables exist with correct columns.
- **FR-009**: Verification queries MUST confirm all indexes from the schema design are present.
- **FR-010**: Verification queries MUST confirm RLS is enabled on all 10 reservation tables.
- **FR-011**: Verification queries MUST confirm the `get_room_availability`, `confirm_reservation`, and `cancel_reservation` RPCs exist.
- **FR-012**: Verification queries MUST confirm seed data counts match expected values.
- **FR-013**: A hold expiry cleanup mechanism MUST exist via Supabase cron (pg_cron) calling a cleanup RPC on a configurable schedule (e.g., every 1 minute).
- **FR-014**: The hold expiry cleanup MUST change status from `active` to `expired` for holds where `expires_at < now()`.
- **FR-015**: The hold expiry cleanup MUST write an audit log entry for each expired hold.
- **FR-016**: Expired holds MUST NOT block room availability in the `get_room_availability` RPC or equivalent service logic.
- **FR-017**: The seed data migration MUST be idempotent — safe to run on a database that already has matching reference data.

### Key Entities

- **Seed Migration**: A Supabase SQL migration file that inserts sample data (rooms, room types, guests, companies, reservations) into the development database. Must be idempotent (UPSERT or conditional insert).
- **Verification Queries**: A standalone SQL script with `[PASS]` / `[FAIL]` labels per check, confirming schema integrity after migration — table existence, column types, index existence, RLS status, RPC function existence, seed data counts.
- **Hold Expiry Mechanism**: A Supabase cron (pg_cron) scheduled job that periodically calls a cleanup RPC to transition active holds past their `expires_at` to `expired` status and writes audit log entries.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Developer can reset the database and run the seed migration in under 30 seconds, resulting in a fully populated database with 10+ rooms, 1+ guest, 1+ company, and 3+ reservations.
- **SC-002**: All verification queries complete in under 5 seconds against a development database.
- **SC-003**: Expired holds are cleaned up within 5 minutes of their `expires_at` timestamp passing.
- **SC-004**: No verification query returns a false negative (each confirmed element actually exists and works correctly).
- **SC-005**: Running the seed migration twice produces no errors and no duplicate rows.

## Assumptions

- The reservation model schema migration (`20260628000001_create_reservation_model.sql`) has already been applied and all tables, enums, and RPCs exist.
- Seed data is for development and testing environments only — production seed data (if needed) will be handled separately.
- Room types, rooms, and contacts tables already exist with reference data from prior migrations.
- The hold expiry mechanism uses Supabase cron (pg_cron) — no external cron service or Edge Function needed.
- Verification queries will be delivered as a standalone SQL verification script with `[PASS]` / `[FAIL]` labels per check, runnable via psql or Supabase dashboard. Not integrated into a CI/CD pipeline at this stage.
- No existing `bookings` data needs to be migrated into the new `reservations` model — this is a greenfield rollout alongside the existing bookings module.
