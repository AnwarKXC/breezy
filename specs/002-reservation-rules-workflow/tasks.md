---

description: "Task list for implementing reservation non-negotiable rules and domain model enforcement"
---

# Tasks: Reservation Rules and MCP Workflow

**Input**: Design documents from `specs/002-reservation-rules-workflow/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by user story. This feature codifies 14 non-negotiable reservation rules, the MCP inspection workflow, and the target domain model. The reference documents are already created — these tasks fix identified codebase gaps and implement enforcement mechanisms.

## Format: `[ID] [P] [Story] Description with file path`

---

## Phase 1: Setup

**Purpose**: No project initialization needed — all infrastructure already exists.

- [X] T001 Verify all reference documents are consistent with the actual codebase at `src/modules/reservations/` and `src/app/api/reservations/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix bugs and permission gaps identified in research that block ALL user stories.

**⚠️ No user story work can begin until this phase is complete**

- [X] T002 Fix bug: Add missing `RESERVATION_CANCEL` action constant to `src/config/actionPermissions.ts` and map it to `ROLES.FRONT_DESK` and `ROLES.ADMIN` arrays
- [X] T003 Fix bug: Update `useReservations.cancel()` in `src/modules/reservations/hooks/useReservations.ts` to pass `{ reason }` in the request body
- [X] T004 Add missing `reservation:*` permission actions to `src/config/actionPermissions.ts`: `RESERVATION_CONFIRM`, `RESERVATION_CHECK_IN`, `RESERVATION_CHECK_OUT`, `RESERVATION_OVERRIDE_PRICE`, `RESERVATION_RECORD_PAYMENT`, `RESERVATION_REFUND_PAYMENT` with role mappings per `contracts/permissions.md`
- [X] T005 Add missing client hook functions (`confirm`, `createHold`, `releaseHold`, `noShow`) to `src/modules/reservations/hooks/useReservations.ts` referencing the existing service functions in `src/modules/reservations/services/reservationService.ts`

**Checkpoint**: Foundation ready — all bugs fixed, permissions complete, hooks complete

---

## Phase 3: User Story 1 - Non-Negotiable Rules Enforcement (Priority: P1) 🎯 MVP

**Goal**: All 14 non-negotiable rules are verifiably enforced in the codebase. Each rule has a clear enforcement point.

**Independent Test**: A reviewer can inspect each rule against its enforcement point — database constraint, service validation, API middleware, or audit log.

### Rule 7: Double Booking Prevention

- [X] T006 [P] [US1] Add `confirm_reservation` RPC migration in `supabase/migrations/` that validates room availability inside a transaction using the exclusion constraint pattern from `contracts/` and research findings — prevents two concurrent users from confirming the same room
- [X] T007 [US1] Integrate `reservation_rooms_no_overlap` exclusion constraint (btree_gist) into the migration — blocks overlapping `daterange` entries for active statuses (`held`, `reserved`, `occupied`)

### Rule 10: RBAC Permission Enforcement

- [X] T008 [P] [US1] Update `src/app/api/reservations/[id]/confirm/route.ts` to use `ACTIONS.RESERVATION_CONFIRM` (instead of `ACTIONS.BOOKINGS_WRITE`) for consistent permission naming
- [X] T009 [P] [US1] Update `src/app/api/reservations/[id]/check-in/route.ts` and `check-out/route.ts` to use `ACTIONS.RESERVATION_CHECK_IN` / `RESERVATION_CHECK_OUT`

### Rule 13: Price Override Audit Trail

- [X] T010 [US1] Wire price override audit logging in `src/modules/reservations/services/reservationService.ts` — when `price_source = 'manual_override'`, call `logReservationAction()` with old price, new price, reason, actor ID per `contracts/audit-events.md`

### Rule 14: Hold Expiry Cleanup

- [X] T011 [US1] Create hold expiry cron function at `supabase/functions/release-expired-helds/index.ts` — runs every 5 minutes via pg_cron or Deno Edge Function, sets `status = 'expired'` where `expires_at < now() and status = 'active'`

### Delivery Check

- [X] T012 [US1] Verify all 14 rules: run quickstart scenarios 1–5 from `quickstart.md`, confirm each rule maps to an enforcement point recorded in `research.md`

**Checkpoint**: US1 complete — all 14 rules enforced. Feature is independently testable via quickstart scenarios.

---

## Phase 4: User Story 2 - MCP Inspection Workflow (Priority: P2)

**Goal**: Developers have an automated MCP inspection workflow that produces complete findings documents in under 30 minutes.

**Independent Test**: Run the inspection workflow against the current database — a findings document is produced listing all existing tables, their columns, and the extend/create decision for each.

- [X] T013 [P] [US2] Create MCP inspection runbook at `docs/runbooks/mcp-inspection.md` based on `contracts/mcp-inspection.md` — step-by-step commands for Supabase MCP tools with expected CLI output examples
- [X] T014 [P] [US2] Create MCP findings template at `docs/templates/mcp-findings-template.md` — markdown template matching the expected output format from `contracts/mcp-inspection.md` section 3
- [X] T015 [US2] Create MCP fallback runbook at `docs/runbooks/mcp-fallback.md` — Supabase CLI commands (`supabase db dump`, `supabase db diff`) and `information_schema` SQL queries for when MCP is unavailable
- [X] T016 [US2] Run MCP inspection against current development database and produce a findings document in `docs/mcp-findings/YYYY-MM-DD.md` to validate the workflow completes in under 30 minutes (SC-002)

**Checkpoint**: US2 complete — MCP inspection is documented, repeatable, and time-bound.

---

## Phase 5: User Story 3 - Domain Model Validation (Priority: P2)

**Goal**: Domain model enforcement — status transitions, booking types, billing parties, room assignment/physical status separation are validated at every layer.

**Independent Test**: Create a reservation in each booking type, move it through valid status transitions, assign correct billing party, verify room assignment and physical status are independently tracked.

- [X] T017 [P] [US3] Add status transition validation to `src/modules/reservations/validation.ts` — verify `confirmReservation` rejects invalid transitions per the status map in `data-model.md` section 1
- [X] T018 [P] [US3] Add booking type validation — verify `createReservationDraft` rejects invalid booking types and enforces guest requirements per booking type (individual requires primary guest, company requires company_id, etc.)
- [X] T019 [P] [US3] Add billing party consistency check — verify `billing_party` is consistent with `booking_type` (company booking → billing party must be company) and reject mismatches in `validation.ts`
- [X] T020 [US3] Add room assignment status tracking — verify that when `reservation_rooms.status` changes, `room_status_history` is updated independently from the reservation's lifecycle status per `data-model.md` section 4
- [X] T021 [US3] Add physical room status independence — verify `check_outReservation` sets room physical status to `dirty` (via `rooms.status`) without changing the reservation lifecycle status separation rules in `data-model.md` section 5

**Checkpoint**: US3 complete — all domain model rules validated at service layer.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation, build correctness, and documentation finalization.

- [X] T022 Run `quickstart.md` scenario 6 (MCP inspection workflow test) — verify end-to-end
- [X] T023 Run `pnpm build` — fix any type errors from new permission actions in `src/config/actionPermissions.ts`
- [X] T024 Run `pnpm lint` — fix any linting issues
- [X] T025 Run Playwright E2E tests at `e2e/` — verify no regressions from permission changes
- [X] T026 Update `docs/runbooks/mcp-inspection.md` with any lessons learned from the first full run

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Description |
|-------|-----------|-------------|
| Phase 1 (Setup) | — | Can start immediately |
| Phase 2 (Foundational) | Phase 1 | Blocks ALL user stories |
| Phase 3 (US1 - P1) | Phase 2 | MVP scope |
| Phase 4 (US2 - P2) | Phase 2 | Independent of US1 |
| Phase 5 (US3 - P2) | Phase 2 | Independent of US1/US2 |
| Phase 6 (Polish) | Phases 3-5 | After all stories done |

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories — MVP scope
- **US2 (P2)**: No dependencies on other stories — independent workflow
- **US3 (P2)**: No dependencies on other stories — independent validation layer

### Within Each Phase

- Tasks marked [P] can run in parallel within the same phase

---

## Parallel Opportunities

- Phase 2: T002 and T003 (bug fixes) can run in parallel
- Phase 3: T006, T008, T009, T011 can run in parallel (different files)
- Phase 4: T013, T014, T015 (runbooks) can run in parallel
- Phase 5: T017, T018, T019 (validations) can run in parallel
- Phase 6: T023, T024, T025 (build/lint/tests) can run in parallel

## Parallel Example: User Story 1

```bash
# Launch all parallel tasks for US1 together:
Task: "Add confirm_reservation RPC migration in supabase/migrations/"
Task: "Update confirm route to use ACTIONS.RESERVATION_CONFIRM"
Task: "Create hold expiry cron function at supabase/functions/release-expired-holds/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T005 — blocks everything)
3. Complete Phase 3: User Story 1 (T006-T012)
4. **STOP and VALIDATE**: Run quickstart scenarios 1-5
5. Document enforcement points for all 14 rules

### Incremental Delivery

1. Setup + Foundational → Foundation ready (bugs fixed, permissions complete)
2. Add US1 (rules enforcement) → Test via scenarios → Deploy/Demo (MVP!)
3. Add US2 (MCP workflow) → Test via scenario 6 → Deploy/Demo
4. Add US3 (domain model validation) → Test via scenario → Deploy/Demo

---

## Summary

- **Total tasks**: 26
- **Phase 1 (Setup)**: 1 task
- **Phase 2 (Foundational)**: 4 tasks
- **Phase 3 (US1 - P1)**: 7 tasks ← **MVP**
- **Phase 4 (US2 - P2)**: 4 tasks
- **Phase 5 (US3 - P2)**: 5 tasks
- **Phase 6 (Polish)**: 5 tasks
- **Parallel-ready tasks**: 10 marked [P]
- **Parallel-ready stories**: US1, US2, US3 are independent

### Suggested MVP Scope

User Story 1 only (T001-T012 = 12 tasks). Delivers: all 14 non-negotiable rules enforced in the codebase, bugs fixed, permissions complete, hold expiry cron deployed, price override audit trail wired.

### Current State

Reference documents are already complete (research.md, data-model.md, contracts/, quickstart.md). This tasks.md focuses on the remaining code changes needed to match the codebase to the documented rules and domain model.
