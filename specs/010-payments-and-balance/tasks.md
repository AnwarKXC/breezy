# Tasks: Payments and Balance

**Input**: Design documents from `specs/010-payments-and-balance/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No test tasks — feature spec does not request TDD. Validation uses quickstart.md scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Migration**: `supabase/migrations/20260628000006_payments_and_balance.sql` — single migration for all DDL + RPCs
- **Documents**: `specs/010-payments-and-balance/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing schema and prepare for migration

- [X] T001 Review existing schema — verify reservations table has paid_amount, balance_amount, total_amount columns; check existing audit log pattern for reference

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema changes that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create reservation_payments table in `supabase/migrations/20260628000006_payments_and_balance.sql`
  - Columns: id (UUID PK), reservation_id (UUID FK → reservations ON DELETE CASCADE), payment_type (TEXT CHECK), method (TEXT CHECK), amount (NUMERIC(12,2) CHECK > 0), currency (TEXT DEFAULT 'USD'), status (TEXT DEFAULT 'pending' CHECK 'pending/paid/failed/refunded'), transaction_reference (TEXT), receipt_number (TEXT), paid_by (TEXT DEFAULT 'guest' CHECK 'guest/company/split'), parent_payment_id (UUID → self FK), notes (TEXT), created_by (UUID), created_at (TIMESTAMPTZ)
- [X] T003 [P] Create deposit_policy_rules table in migration file
  - Columns: id (UUID PK), booking_type (TEXT NOT NULL), billing_party (TEXT nullable), deposit_percentage (NUMERIC(5,2)), deposit_fixed_amount (NUMERIC(12,2)), enforced (BOOLEAN DEFAULT true), created_by (UUID), created_at/updated_at (TIMESTAMPTZ)
  - Constraint: CHECK (deposit_percentage IS NOT NULL OR deposit_fixed_amount IS NOT NULL)
- [X] T004 Add indexes for reservation_payments (reservation_id, parent_payment_id, status) and deposit_policy_rules (booking_type) in migration file

**Checkpoint**: Foundation ready — both tables exist with proper constraints and indexes. User story implementation can begin.

---

## Phase 3: User Story 1 — Record and View Payments (Priority: P1) 🎯 MVP

**Goal**: Front desk user can record payments (deposit, partial, full) and view chronological payment history with running balance.

**Independent Test**: A reservation with total $500 receives a $200 deposit via card. Payment history shows one entry with type=deposit, method=card, amount=$200. Balance updates to $300.

- [X] T005 [US1] Create `record_payment()` RPC in migration file — transactional RPC with SELECT FOR UPDATE that inserts into reservation_payments, updates reservation paid_amount/balance_amount, validates payment_type + method against allowed values, enforces amount > 0, overpayment check, writes audit log, returns JSONB with payment_id and new balance
  - Handle payment types: deposit, partial_payment, full_payment (status = 'paid')
  - Include overpayment check: reject if paid_amount + amount > total_amount (unless overpayment permission)
- [X] T006 [US1] Create `get_payment_history()` RPC in migration file — returns chronological payment rows for a reservation_id with a running_paid_amount column (adds paid amounts, subtracts refund amounts), ordered by created_at ASC

**Checkpoint**: US1 complete — payments can be recorded and payment history is viewable. Run quickstart Scenarios 1-2 to validate.

---

## Phase 4: User Story 2 — Balance Tracking and Guarantees (Priority: P2)

**Goal**: System enforces deposit requirements, prevents overpayment, handles guarantee-only and company-invoice types.

**Independent Test**: A reservation with $500 total and 20% deposit policy receives no payment. System prevents check-in showing $100 deposit required. After $100 deposit, check-in allowed, balance = $400.

- [X] T007 [US2] Create `check_deposit_requirement()` RPC in migration file — STABLE function that looks up matching deposit_policy_rules by reservation booking_type and billing_party, computes required amount (percentage of total or fixed), returns deposit_required, required_amount, current_paid, shortfall, met, and message
- [X] T008 [US2] Extend `record_payment()` to support guarantee_only and company_invoice payment types — for these types, set status = 'pending', do NOT change paid_amount or balance_amount; for company_invoice set paid_by = 'company'; for guarantee_only record the guarantee method in method column

**Checkpoint**: US2 complete — deposit policy enforced, guarantee/invoice types handled. Run quickstart Scenarios 6-8 to validate.

---

## Phase 5: User Story 3 — Refunds and Payment Corrections (Priority: P3)

**Goal**: Authorized users can issue refunds referencing original payments, and correct payment records with full audit trail.

**Independent Test**: A $200 card payment is recorded. Admin issues $50 refund referencing original payment. Paid amount drops to $150, refund links to original payment in history.

- [X] T009 [US3] Create `refund_payment()` RPC in migration file — validates parent payment exists with status = 'paid', validates refund amount ≤ remaining refundable (original amount - previous refunds), locks both payment and reservation rows, inserts refund entry with payment_type='refund' status='refunded' and parent_payment_id, reduces paid_amount, writes audit log, returns JSONB with refund_id and new balance
- [X] T010 [US3] Implement payment correction support — add `corrected_by_id` nullable column to reservation_payments referencing the correction entry; corrections preserve original entry unchanged and create a replacement entry with corrected data; both entries linked via corrected_by_id; audit log written for both old and new entries (FR-012)

**Checkpoint**: US3 complete. Run quickstart Scenarios 4-5 to validate refunds.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T011 Run all 9 quickstart.md validation scenarios end-to-end in Supabase SQL Editor to verify all payment flows
- [X] T012 Verify concurrent safety — simulate two simultaneous record_payment() calls for same reservation to confirm SELECT FOR UPDATE prevents balance corruption

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 and US2 can run in parallel (different RPCs)
  - US3 depends on US1 (refund_payment depends on record_payment being complete)
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational — minimal overlap with US1 (extends record_payment RPC)
- **User Story 3 (P3)**: Can start after Foundational — depends on reservation_payments table from Foundation and record_payment() from US1 for refund workflow

### Within Each User Story

- RPC implementation before validation
- Core functionality before edge cases
- Story complete before moving to next priority

### Parallel Opportunities

- T002 and T003 (DPR table creation) can run in parallel
- T005 (record_payment) and T007 (check_deposit_requirement) can run in parallel
- T006 (get_payment_history) can run in parallel with US2 tasks
- Multiple quickstart scenarios can run in parallel

---

## Parallel Example: User Story 1

```bash
# No test tasks — use quickstart validation instead.
# Both US1 RPCs can be implemented sequentially (record_payment, then get_payment_history):
Task: "Create record_payment() RPC in migration"
Task: "Create get_payment_history() RPC in migration"
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
3. Add User Story 2 → Run quickstart Scenarios 6-8 → Deploy/Demo
4. Add User Story 3 → Run quickstart Scenarios 4-5 → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- All work goes into a single migration file: `supabase/migrations/20260628000006_payments_and_balance.sql`
- Stop at any checkpoint to validate story independently via quickstart.md
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
