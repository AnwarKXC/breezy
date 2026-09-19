---

description: "Task list for room click details modal — components, API, history table, acceptance verification"
---

# Tasks: Room Click Details Modal & Final Acceptance

**Input**: Design documents from `/specs/016-room-details-modal/`

**Prerequisites**: plan.md, spec.md (3 user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: E2E test in Phase 6 (T013). Unit tests for service and hook are recommended but not blocking.

**Organization**: Tasks are grouped by user story. Components build bottom-up (cards first, then modal shell).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (Shared Types)

**Purpose**: Define TypeScript types all components depend on

- [x] T001 Add `RoomDetailsWithHistory`, `RoomReservationSummary`, `RoomHistoryEvent` types to `src/modules/reservations/types.ts` per data-model.md entity definitions

---

## Phase 2: Foundational (Service + API + Hook)

**Purpose**: Data layer that all UI components consume. Must complete before any component work.

- [x] T002 [P] Create `roomDetailsService.ts` at `src/modules/rooms/services/roomDetailsService.ts` combining room data from `rooms` table, current/next reservation from `reservations` + `reservation_rooms` + `guests` + `contacts`, availability from `get_room_availability()` RPC, and history events from `reservation_status_history` + `room_status_history` + `reservation_holds` + `audit_logs` per research.md event source mapping
- [x] T003 Create API route `GET /api/rooms/[id]/details-with-history` at `src/app/api/rooms/[id]/details-with-history/route.ts` per contracts/api-contract.md — verify session, check `rooms:read` permission, validate `id` param with Zod, call `roomDetailsService`, return `RoomDetailsWithHistory` JSON, handle 401/403/404 errors
- [x] T004 Create `useRoomDetails.ts` hook at `src/modules/rooms/hooks/useRoomDetails.ts` calling the API endpoint on modal open with loading/error states per research.md data fetching pattern

---

## Phase 3: User Story 1 — Room Details Modal (Priority: P1) 🎯 MVP

**Goal**: Modal opens on room click showing header, status card, current reservation (if any), next reservation (if any), availability, and history table. Works for all 12 room states.

**Independent Test**: Click a room card → modal opens with correct data for that room's state.

### Implementation for User Story 1

- [x] T005 [P] [US1] Create `RoomDetailsHeader` at `src/modules/rooms/components/RoomDetailsHeader.tsx` displaying room number, room type name, floor, capacity, current physical status per spec FR-002
- [x] T006 [P] [US1] Create `RoomStatusCard` at `src/modules/rooms/components/RoomStatusCard.tsx` showing physical status, housekeeping status, maintenance status, blocking reason per spec FR-008/FR-009 — adapts display for each room state
- [x] T007 [P] [US1] Create `CurrentReservationCard` at `src/modules/rooms/components/CurrentReservationCard.tsx` showing reservation number, guest name, company, dates, nights, billing party, payment status, balance, special requests per spec FR-004 — shows hold details for held rooms per FR-005
- [x] T008 [P] [US1] Create `NextReservationCard` at `src/modules/rooms/components/NextReservationCard.tsx` showing future guest/company, arrival date, departure date, reservation status per spec FR-006
- [x] T009 [P] [US1] Create `RoomAvailabilityCard` at `src/modules/rooms/components/RoomAvailabilityCard.tsx` showing availableNow, availableFrom/Until, unavailableReason per spec FR-007
- [x] T010 [US1] Create `RoomDetailsModal` shell at `src/modules/rooms/components/RoomDetailsModal.tsx` combining all cards + history table, handling modal open/close with overlay, loading state, empty state (room has no reservations), per spec FR-001/FR-003

**Checkpoint**: Modal opens for occupied room → shows header + all cards + history table placeholder.

---

## Phase 4: User Story 2 — Room History Table (Priority: P2)

**Goal**: History table within modal shows chronological events from all data sources with pagination and empty state.

**Independent Test**: Open modal for room with history → table shows events in reverse chronological order.

### Implementation for User Story 2

- [x] T011 [US2] Create `RoomHistoryTable` at `src/modules/rooms/components/RoomHistoryTable.tsx` with columns: Date/Time, Event Type, Reservation No., Guest/Company, Room Status, Reservation Status, Check-in, Check-out, Action By, Notes per spec FR-012 — events in reverse chronological order per FR-013 — pagination/cursor support per FR-016 — empty state message per FR-017 — historical events visually distinct per FR-015 — integrate into RoomDetailsModal shell

**Checkpoint**: History table loads and displays events for room with multiple historical events.

---

## Phase 5: User Story 3 — Acceptance Criteria Verification (Priority: P3)

**Goal**: Documented verification of all 26 final acceptance criteria with traceable verification steps.

**Independent Test**: Run verification steps against deployed system — all 26 criteria confirmed passing.

### Implementation for User Story 3

- [x] T012 [US3] Create acceptance criteria checklist at `specs/016-room-details-modal/acceptance-checklist.md` mapping all 26 criteria from the plan doc to verification steps:
  - Criteria 1–10: MCP SQL queries verifying individual/company/multi-room reservations, availability, pricing, payments
  - Criteria 11–17: API call sequences confirming hold expiry, double booking prevention, status transitions
  - Criteria 18–22: UI verification confirming room status separation, audit logging, RLS enforcement
  - Criteria 23–26: MCP queries + API calls confirming cancellation releases rooms, checkout marks dirty, all audit logs exist
  - Each criterion includes: description, verification method (MCP/API/UI), expected result, pass/fail checkbox

**Checkpoint**: Acceptance checklist ready for administrator or QA to execute.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: E2E testing, code quality

- [x] T013 Write E2E test at `e2e/room-details-modal.spec.ts` covering all 12 room states (available, occupied, held, confirmed, due-in, due-out, dirty, clean, inspected, maintenance, out-of-order, blocked), history table pagination, and accessibility per quickstart.md
- [x] T014 Run `npm run lint` and `npm run build` to verify no regressions — fix any TypeScript errors or lint violations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on T001 (types)
- **US1 Modal (Phase 3)**: Depends on T004 (hook)
- **US2 History (Phase 4)**: Depends on T004 (hook) — parallel with Phase 3 components
- **US3 Acceptance (Phase 5)**: No dependencies
- **Polish (Phase 6)**: Depends on T010, T011, T012

### Within Each Phase

- Phase 2: T002 → T003 → T004 (sequential chain)
- Phase 3: T005-T009 fully parallel — all components consume same hook, different files
- Phase 4: T011 can run parallel with T010 (modal shell)

### Parallel Opportunities

```bash
# Phase 2: T002 (service) can run parallel with Phase 5: T012 (acceptance checklist)
# Phase 3: All 5 card components (T005-T009) run in parallel
# Phase 4 (T011) can run parallel with T010 (modal shell)
```

---

## Parallel Example: Phase 3 Components

```bash
# Launch all card components in parallel (independent files):
Task: "T005 [US1] Create RoomDetailsHeader"
Task: "T006 [US1] Create RoomStatusCard"
Task: "T007 [US1] Create CurrentReservationCard"
Task: "T008 [US1] Create NextReservationCard"
Task: "T009 [US1] Create RoomAvailabilityCard"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: T001 (types)
2. Complete Phase 2: T002-T004 (service → API → hook)
3. Complete Phase 3: T005-T010 (all 6 components)
4. **STOP and VALIDATE**: Modal opens on room click, shows correct data for occupied room
5. MVP delivered: Front desk can view room details for any room

### Incremental Delivery

1. Setup + Foundational → Data layer ready
2. US1 (Phase 3) → Modal with cards (MVP!)
3. US2 (Phase 4) → History table
4. US3 (Phase 5) → Acceptance checklist (can run in parallel with development)
5. Polish (Phase 6) → E2E tests + code quality

---

## Notes

- All components in `src/modules/rooms/components/` — co-located with existing room components
- Modal uses existing `useTranslation()` for all text labels (constitution requirement)
- RTL/LTR layouts via Tailwind CSS directional variants
- Service uses existing Supabase server client pattern from other service files
- E2E tests use existing Playwright setup in `e2e/` directory
