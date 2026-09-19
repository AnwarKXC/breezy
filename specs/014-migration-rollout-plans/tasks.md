---

description: "Task list for migration rollout — seed data, verification script, hold expiry cleanup"
---

# Tasks: Migration Rollout Plans

**Input**: Design documents from `/specs/014-migration-rollout-plans/`

**Prerequisites**: plan.md, spec.md (3 user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: No separate test tasks — verification is handled by the verification script (US2). E2E validation via `supabase db reset` + verification script.

**Organization**: Tasks are grouped by user story. Three stories produce three migration/script files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1=seed, US2=verification, US3=hold expiry)
- Include exact file paths in descriptions

## Path Conventions

- **Migrations**: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- **Scripts**: `supabase/migrations/scripts/`

---

## Phase 1: Setup

**Purpose**: Create directory for verification script output

- [x] T001 Create scripts directory at `supabase/migrations/scripts/` for the standalone verification SQL script

---

## Phase 2: User Story 1 — Seed Data Migration (Priority: P1) 🎯 MVP

**Goal**: One idempotent SQL migration file that populates the development database with 10 rooms, 2 guests, 1 company + price override, and 3 reservations (checked_in, checked_out, future company) with all child records.

**Independent Test**: `supabase db reset` → query `rooms`, `guests`, `reservations` → counts match expected values (14 rooms total, 2 guests, 3 reservations).

### Implementation for User Story 1

- [x] T002 [US1] Create seed data migration at `supabase/migrations/20260628000008_seed_reservation_data.sql` containing:
  - Room types reference (4 types already seeded — use `SELECT` to reference by slug)
  - 10 rooms across 3 types (standard/101-106, deluxe/201-202, suite/301-302) — 2 in non-bookable states (105=maintenance, 106=cleaning) per data-model.md room table
  - 2 guests (Ahmed Ali, Sara Khan) with email, phone, country, passport per data-model.md guest list
  - 1 company contact (Al-Mawarid Trading, type=company) in `public.contacts`
  - 1 company price override (Al-Mawarid → standard room type, $80/night corporate rate) in `public.price_overrides`
  - 3 reservations (RSV-SEED-001 checked_in, RSV-SEED-002 checked_out, RSV-SEED-003 future company) per data-model.md reservation table
  - Child records per reservation: `reservation_rooms`, `reservation_guests`, `reservation_company_info` (RSV-003 only), `reservation_pricing_items`, `reservation_status_history`
  - All inserts use `ON CONFLICT (natural_key) DO NOTHING` for idempotency per research.md pattern
  - Dates use `CURRENT_DATE + N` expressions so seed is always current per research.md strategy

**Checkpoint**: `supabase db reset` produces fully populated development database.

---

## Phase 3: User Story 2 — Verification Script (Priority: P2)

**Goal**: One standalone SQL script that confirms all 10 reservation tables, ~15 indexes, all RLS policies, and 3 RPCs exist, and seed data counts match expectations.

**Independent Test**: Run via psql → all checks output `[PASS]`, script exits with code 0.

### Implementation for User Story 2

- [x] T003 [US2] Create verification script at `supabase/migrations/scripts/verify-reservation-migration.sql` with DO-block checks per contracts/verification-script.md covering:
  - Extension checks (2): `btree_gist`, `pg_cron` (graceful WARN if missing)
  - Enum checks (10): `reservation_status`, `reservation_booking_type`, `billing_party`, `reservation_source`, `reservation_room_status`, `reservation_guest_role`, `reservation_payment_type`, `reservation_payment_method`, `price_source`, `room_physical_status`
  - Table checks (10): `reservations`, `reservation_rooms`, `reservation_guests`, `reservation_company_info`, `reservation_pricing_items`, `reservation_payments`, `reservation_holds`, `reservation_notes`, `reservation_status_history`, `room_status_history`
  - Index checks: At least 15 indexes across reservation tables (query `pg_indexes` for reservation-prefixed index names)
  - RLS checks (10): Each table has `rowsecurity` enabled + at least 1 policy (query `pg_policies`)
  - RPC checks (3): `get_room_availability`, `confirm_reservation`, `cancel_reservation` functions exist and are callable
  - Trigger checks (~8): `updated_at` triggers on tables with `updated_at` column
  - Seed data checks (5): Rooms count ≥14, guests count ≥2, company contacts count ≥1, reservations count ≥3, price overrides count ≥1
  - Final summary: If any check failed, `RAISE EXCEPTION` with non-zero exit code per contracts/verification-script.md exit convention

**Checkpoint**: All verification checks pass against a fully migrated and seeded database.

---

## Phase 4: User Story 3 — Hold Expiry Cleanup (Priority: P3)

**Goal**: One migration file that creates the `expire_reservation_holds()` RPC and registers a pg_cron scheduled job to clean up stale room holds every 1 minute.

**Independent Test**: Insert a hold with 1-minute expiry, wait, verify status → `expired` after pg_cron runs, room available per `get_room_availability()`.

### Implementation for User Story 3

- [x] T004 [US3] Create hold expiry cleanup migration at `supabase/migrations/20260628000009_hold_expiry_cleanup.sql` containing:
  - `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog` (idempotent)
  - `expire_reservation_holds()` RPC per contracts/hold-expiry-rpc.md:
    - Select `reservation_holds` where `status = 'active'` and `expires_at < now()` with `FOR UPDATE` lock
    - Update each selected row: `status = 'expired'`, `updated_at = now()`
    - Insert `public.logs` entry per expired hold with action `'hold_expired'`, target_type `'reservation_hold'`
    - Return `void`; graceful no-op when no expired holds
  - `cron.schedule('expire-reservation-holds', '1 minute', ...)` per contracts/hold-expiry-rpc.md pg_cron job definition
  - Idempotent: use `PERFORM cron.unschedule(...)` before `cron.schedule(...)` to allow safe re-run
  - Write audit log entries via existing `public.logs` table using `hold_expired` action (already added to `log_action` enum)

**Checkpoint**: Hold expiry mechanism running — holds expire automatically and write audit trails.

---

## Phase 5: Polish & Validation

**Purpose**: End-to-end validation of all three migrations

- [ ] T005 Run full migration sequence (`supabase db reset`) then execute verification script — confirm all checks pass and exit code is 0
- [ ] T006 Validate hold expiry: create short-lived hold with 1-minute expiry, wait for pg_cron cycle, confirm status changed to `expired` and audit log entry exists per quickstart.md hold expiry testing section

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 Seed Data (Phase 2)**: No dependencies (references existing schema migration only)
- **US2 Verification (Phase 3)**: Depends on T002 (US1 seed data structure for count checks) — NOT on T004
- **US3 Hold Expiry (Phase 4)**: No dependencies on T002 or T003 — fully independent
- **Polish (Phase 5)**: Depends on T002, T003, T004 completion

### User Story Dependencies

- **US1 (P1)**: Independent — no dependencies on other stories
- **US2 (P2)**: Depends on US1 (verification checks seed data counts)
- **US3 (P3)**: Independent — no dependencies on US1 or US2

### Within Each Phase

- Phase 2: Single task (T002) — no parallel opportunities within phase
- Phase 3: Single task (T003) — no parallel opportunities within phase
- Phase 4: Single task (T004) — no parallel opportunities within phase

### Parallel Opportunities

- T003 and T004 can run in parallel (different files, no shared dependencies) — once T002 completes, T003 can start alongside T004
- Phase 2 (T002) and Phase 4 (T004) can actually start in parallel since T004 has no dependency on T002 — both are independent migration files

---

## Parallel Example

```bash
# After T001 completes, launch in parallel:
Task: "T002 [US1] Create seed data migration at supabase/migrations/20260628000008_seed_reservation_data.sql"
Task: "T004 [US3] Create hold expiry cleanup migration at supabase/migrations/20260628000009_hold_expiry_cleanup.sql"

# After T002 completes:
Task: "T003 [US2] Create verification script at supabase/migrations/scripts/verify-reservation-migration.sql"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: T001 (scripts directory) — 1 task
2. Complete Phase 2: T002 (seed data) — 1 task
3. **STOP and VALIDATE**: `supabase db reset` → query rooms/guests/reservations
4. MVP delivered: Development database populated with realistic hotel data

### Incremental Delivery

1. Phase 1 + Phase 2 → Seed data (MVP!) — developers can start building/testing
2. Phase 4 (parallel) → Hold expiry mechanism
3. Phase 3 → Verification script (depends on T002 seed structure)
4. Phase 5 → Full end-to-end validation

### Parallel Team Strategy

With 2 developers after T001:
- Developer A: T002 (seed migration) — starts immediately
- Developer B: T004 (hold expiry) — starts immediately, no deps on A

After T002 completes:
- Developer A or B: T003 (verification script)

---

## Notes

- All tasks are single-file creations — each migration file is self-contained
- T002 is the most complex task (seed data with ~30+ INSERT statements across ~10 tables)
- Migration naming follows existing convention: `YYYYMMDDHHMMSS_description.sql`
- Seed data is idempotent via `ON CONFLICT DO NOTHING` — safe to re-run during `supabase db reset`
- pg_cron extension uses `IF NOT EXISTS` — safe on environments without pg_cron (local dev without proper Docker image)
- Verification script uses `RAISE NOTICE` for PASS/FAIL labels and `RAISE EXCEPTION` for non-zero exit on failure
