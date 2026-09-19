# Tasks: Pricing and Company Billing

**Input**: Design documents from `specs/009-pricing-company-billing/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No test tasks — feature spec does not request TDD. Validation uses quickstart.md scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Migration**: `supabase/migrations/20260628000005_pricing_company_billing.sql` — single migration for all DDL + RPCs
- **Documents**: `specs/009-pricing-company-billing/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing schema and prepare for migration

- [X] T001 Review existing schema for reservations, reservation_pricing_items, company_price_overrides, room_types, rooms, and contacts (companies) to confirm column names and FK targets

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema changes that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create billing_type enum and add billing_type + split_percentage columns to reservations table in `supabase/migrations/20260628000005_pricing_company_billing.sql`
  - Enum values: 'guest_pays', 'company_room_only', 'company_all_charges', 'split'
  - Default billing_type = 'guest_pays'
  - split_percentage NUMERIC(5,2) CHECK (split_percentage >= 0 AND split_percentage <= 100)
- [X] T003 [P] Create seasonal_rates table with indexes in migration file
  - Columns: id (UUID PK), name (TEXT NOT NULL), start_date (DATE NOT NULL), end_date (DATE NOT NULL), room_type_id (UUID FK → room_types), override_rate (NUMERIC(10,2) CHECK >= 0), currency (TEXT DEFAULT 'USD'), status (TEXT DEFAULT 'active'), created_by (UUID NOT NULL), created_at/updated_at (TIMESTAMPTZ)
  - Indexes on (room_type_id, start_date, end_date) and (status)
- [X] T004 [P] Create room_specific_rates table with indexes in migration file
  - Columns: id (UUID PK), room_id (UUID FK → rooms), start_date (DATE), end_date (DATE), override_rate (NUMERIC(10,2) CHECK >= 0), reason (TEXT), created_by (UUID), created_at/updated_at (TIMESTAMPTZ)
  - Index on (room_id, start_date, end_date)
- [X] T005 [P] Extend reservation_pricing_items with source_type, source_ref, rate_per_night_at_booking columns in migration file
  - source_type TEXT CHECK ('default_rate', 'seasonal_rate', 'room_specific_rate', 'company_override', 'manual_override')
  - source_ref UUID (nullable — FK to source row, NULL for default_rate)
  - rate_per_night_at_booking NUMERIC(10,2)
- [X] T006 [P] Create price_override_audit_log table with indexes in migration file
  - Columns: id (UUID PK), reservation_id (UUID FK → reservations), room_id (UUID FK → rooms), night_date (DATE), old_rate (NUMERIC(10,2)), new_rate (NUMERIC(10,2)), reason (TEXT NOT NULL), actor_id (UUID), permission_level (TEXT CHECK 'admin'/'front_desk'), threshold_checked (BOOLEAN DEFAULT false), created_at (TIMESTAMPTZ)
  - Indexes on (reservation_id) and (actor_id)

**Checkpoint**: Foundation ready — all new tables, enums, and extended columns exist. User story implementation can begin.

---

## Phase 3: User Story 1 — Explainable Per-Room Pricing Breakdown (Priority: P1) 🎯 MVP

**Goal**: Front desk users can view an itemized pricing breakdown showing each room-night's rate, source type, and source label.

**Independent Test**: A reservation with two rooms and a company price override is queried. The breakdown shows each room's nightly rate, `source_type = 'company_override'`, and the company name. (US1 test from spec.)

- [X] T007 [P] [US1] Create `get_effective_rate()` helper function in migration file — resolves pricing ladder (manual > company > seasonal > room-specific > default) for a single room-night using COALESCE chain
- [X] T008 [US1] Create `get_pricing_breakdown()` RPC in migration file — returns itemized table with room_id, room_name, night_date, rate, source_type, source_ref, source_label, currency, subtotal_room, billing_type, company_name, company_share, guest_share
  - For confirmed reservations: reads from reservation_pricing_items snapshot
  - For draft reservations: computes live via get_effective_rate()
  - Distributes charges based on billing_type

**Checkpoint**: US1 complete — `get_effective_rate()` and `get_pricing_breakdown()` are functional. Run quickstart Scenarios 1-2 to validate.

---

## Phase 4: User Story 2 — Company Billing Rules and Payer Assignment (Priority: P2)

**Goal**: Front desk users can configure company billing arrangements on reservations. The system applies billing rules and company price overrides.

**Independent Test**: A company reservation is configured with `billing_type = 'company_room_only'`. Pricing breakdown shows room charges assigned to the company and incidentals assigned to the guest. (US2 test from spec.)

- [X] T009 [US2] Create `manage_billing_type()` RPC in migration file — validates billing_type compatibility (company required for company_room_only/company_all_charges/split), sets split_percentage when billing_type = 'split', updates reservations table, triggers recalculation for drafts, writes audit entry

**Checkpoint**: US2 complete — `manage_billing_type()` is functional. Run quickstart Scenarios 5-6 to validate.

---

## Phase 5: User Story 3 — Manual Price Override with Audit Trail (Priority: P3)

**Goal**: Authorized users can manually override room prices with full audit trail. Admin has unlimited adjustment; front desk is constrained by ±10% threshold.

**Independent Test**: An admin overrides a room's nightly rate from $150 to $100 with reason "Guest compensation". Breakdown shows the override and audit log contains old/new prices, reason, and actor. (US3 test from spec.)

- [X] T010 [P] [US3] Create `can_override_pricing()` helper function in migration file — checks if actor is admin (unlimited) or front_desk (within threshold), returns allowed + permission_level + reason
- [X] T011 [US3] Create `apply_manual_override()` RPC in migration file — calls can_override_pricing(), captures old rate via get_effective_rate(), inserts into price_override_audit_log, updates reservation_pricing_items with source_type='manual_override', returns JSONB result with error handling for all edge cases
- [X] T012 [US3] Implement override flag/needs_review mechanism — when reservation dates, rooms, or room types change after a manual override was applied, the override is flagged for review (source_type stays 'manual_override' but adds a `needs_review` flag or log entry)

**Checkpoint**: US3 complete. Run quickstart Scenarios 3-4, 7-8 to validate.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T013 Write audit logging for seasonal/room-specific/company rate changes (FR-013) — trigger-based audit entries when seasonal_rates, room_specific_rates, or company_price_overrides are created/modified
- [X] T014 Run all 8 quickstart.md validation scenarios end-to-end in Supabase SQL Editor
- [X] T015 Verify pricing lock at confirmation — confirmed reservation pricing snapshot is not affected by subsequent rate table changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories proceed in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational — Depends on get_pricing_breakdown (T008) for billing distribution display. Requires US1 to be complete before meaningful testing.
- **User Story 3 (P3)**: Can start after Foundational — Depends on get_effective_rate() (T007) for old rate capture. Can be implemented independently of US1/US2.

### Within Each User Story

- Helper functions before RPCs
- Core RPC logic before error handling
- Story complete before moving to next priority

### Parallel Opportunities

- All Phase 2 DDL tasks marked [P] can run in parallel (T002-T006)
- T007 and T010 (helpers for US1 and US3) can run in parallel
- T008 and T009 (RPCs for US1 and US2) are sequential within their stories
- Each user story can be worked on independently after foundational phase

---

## Parallel Example: User Story 1

```bash
# No test tasks — use quickstart validation instead.
# Helper function before RPC:
Task: "Create get_effective_rate() helper in migration"
Task: "Create get_pricing_breakdown() RPC in migration"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart Scenarios 1-2
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Run quickstart Scenarios 1-2 → Deploy/Demo (MVP!)
3. Add User Story 2 → Run quickstart Scenarios 5-6 → Deploy/Demo
4. Add User Story 3 → Run quickstart Scenarios 3-4, 7-8 → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- All work goes into a single migration file: `supabase/migrations/20260628000005_pricing_company_billing.sql`
- Stop at any checkpoint to validate story independently via quickstart.md
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
