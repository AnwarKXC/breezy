---

description: "Implementation tasks for reservation data model"
---

# Tasks: Reservation Data Model

**Input**: Design documents from `specs/001-reservation-data-model/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P] [Story] Description`

- Used sparingly — most tasks are sequential within each phase
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Minimal setup — most infrastructure already exists from prior work

- [X] T001 Regenerate Supabase database types into `src/services/supabase/database.types.ts` (captures new reservation sub-tables, extended booking_status enum)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix bugs, add missing schema and permissions that block ALL user stories

**⚠️ No user story work can begin until this phase is complete**

- [X] T002 Add missing permission actions (`RESERVATION_CANCEL`, `RESERVATION_CONFIRM`, `RESERVATION_CHECK_IN`, `RESERVATION_CHECK_OUT`, `RESERVATION_OVERRIDE_PRICE`, `RESERVATION_RECORD_PAYMENT`) in `src/config/actionPermissions.ts` and map them to role arrays
- [X] T003 Create numbered Supabase migration `YYYYMMDDHHMMSS_create_reservation_sub_tables.sql` in `supabase/migrations/` with: `reservation_rooms`, `reservation_guests`, `reservation_company_info`, `reservation_pricing_items`, `reservation_payments`, `reservation_holds`, `reservation_notes`, `reservation_status_history`, `room_status_history` + exclusion constraint `reservation_rooms_no_overlap` using btree_gist + indexes from data-model.md
- [X] T004 Create RPC migrations `YYYYMMDDHHMMSS_reservation_rpcs.sql` in `supabase/migrations/` with: `confirm_reservation` (transactional, checks exclusion constraint), `cancel_reservation`, `check_in_reservation`, `check_out_reservation`, `release_expired_holds`, `get_room_availability`
- [X] T005 [P] Fix bug: `ACTIONS.RESERVATION_CANCEL` is undefined — add `RESERVATION_CANCEL` to `src/config/actionPermissions.ts` and add it to `ROLES.FRONT_DESK` and `ROLES.ADMIN` arrays
- [X] T006 [P] Fix bug: `useReservations.cancel()` doesn't pass reason body — update `src/modules/reservations/hooks/useReservations.ts` cancel() to send `{ reason }` in request body
- [X] T007 Create hold expiry cron function at `supabase/functions/release-expired-holds/index.ts` using Deno/Edge Functions or pg_cron, runs every 5 minutes, releases holds where `expires_at < now()` and `status = 'active'`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Front Desk Creates Individual Reservation (Priority: P1) 🎯 MVP

**Goal**: Front desk staff can search room availability → select room → create reservation → check in → check out

**Independent Test**: Search availability for dates, select a room, create confirmed reservation, check guest in, check them out, verify room is released for future booking.

- [X] T008 [P] [US1] Add missing client hook functions (`confirm`, `createHold`, `releaseHold`, `noShow`) to `src/modules/reservations/hooks/useReservations.ts`
- [X] T009 [P] [US1] Integrate pricing service into `getRoomAvailability` in `src/modules/reservations/services/availabilityService.ts` so availability results show real rates instead of 0
- [X] T010 [P] [US1] Create `ReservationStatusBadge` component at `src/modules/reservations/components/ReservationStatusBadge.tsx` — renders colored badge for each reservation status with i18n labels
- [X] T011 [US1] Create `ReservationForm` component at `src/modules/reservations/components/ReservationForm.tsx` — handles guest details, date picker, room selection, billing preference; validates via Zod schema from validation.ts; calls `createDraft`/`confirm` hooks
- [X] T012 [US1] Create `RoomAvailabilityBoard` component at `src/modules/reservations/components/RoomAvailabilityBoard.tsx` — displays rooms grouped by type, shows availability per date range, handles room selection callback
- [X] T013 [US1] Create main reservations page at `src/app/(dashboard)/reservations/page.tsx` — combines RoomAvailabilityBoard and ReservationForm, handles check-in/check-out flow

**Checkpoint**: US1 fully functional on its own — MVP deployable

---

## Phase 4: User Story 2 - Company Booking with Multi-Room (Priority: P2)

**Goal**: Company representative books multiple rooms; company is payer; company rate applies automatically

**Independent Test**: Create company reservation with 3 rooms, assign different guest names, verify company rate applies and billing party is company.

- [X] T014 [P] [US2] Create multi-room selection UI in `src/modules/reservations/components/RoomSelectionList.tsx` — supports selecting multiple rooms across nights, shows per-room rate breakdown
- [X] T015 [P] [US2] Create company billing section in `src/modules/reservations/components/ReservationForm.tsx` — company selector, billing party toggle, company pays dropdown (room_only / all_charges / room_and_tax)
- [X] T016 [US2] Add company rate override integration to `src/modules/reservations/services/pricingService.ts` — verify `calculateRoomPrice` already reads `company_price_override` from contacts, display company rate label in availability results
- [X] T017 [US2] Add guest management UI in `src/modules/reservations/components/GuestListManager.tsx` — add/remove guests per room, role (primary/additional), name, contact, document fields

**Checkpoint**: US1 + US2 both independently testable

---

## Phase 5: User Story 3 - Room Hold with Expiry (Priority: P2)

**Goal**: Staff can hold a room for 30 min; hold blocks availability; auto-expiry releases room

**Independent Test**: Create hold on a room, verify it blocks availability, wait for expiry (or simulate via cron), confirm room is available again.

- [X] T018 [P] [US3] Add hold controls in `src/modules/reservations/components/ReservationForm.tsx` — "Hold Room" button with countdown timer display, calls `createHold`/`releaseHold` hooks
- [X] T019 [P] [US3] Add hold indicators in `src/modules/reservations/components/RoomAvailabilityBoard.tsx` — show hold status (active/expired) per room, prevent selection of held rooms by other users
- [X] T020 [US3] Verify hold expiry auto-release — create hold cron deployment script, test with simulated expiry, verify room becomes available again

**Checkpoint**: US1 + US2 + US3 independently functional

---

## Phase 6: User Story 4 - Manual Price Override (Priority: P3)

**Goal**: Manager overrides room price with permission check; audit trail records old/new price, reason, actor

**Independent Test**: Apply manual price override, verify new price in billing, confirm audit log contains old price, new price, reason, and actor.

- [X] T021 [P] [US4] Add `reservation:override_price` permission action, map to admin role only in `src/config/actionPermissions.ts`
- [X] T022 [P] [US4] Create price override UI at `src/modules/reservations/components/PriceOverrideDialog.tsx` — input new rate, reason field, shows current rate, requires override_price permission; writes to API and triggers audit log
- [X] T023 [US4] Wire up price override with audit logging — verify `reservationPricingItems` records `manual_override_reason` and `manual_override_by`, and `logReservationAction` is called with old/new price

**Checkpoint**: US1-4 independently functional

---

## Phase 7: User Story 5 - Room Details & History (Priority: P3)

**Goal**: Click a room on availability board → modal shows current status, current/next reservation, full event history

**Independent Test**: Click occupied room — see current guest + dates; click empty room — see next booking + history table.

- [X] T024 [P] [US5] Create room details/history API route at `src/app/api/rooms/[id]/details-with-history/route.ts` — returns room info, current reservation, next future reservation, chronological room_status_history
- [X] T025 [P] [US5] Create `RoomDetailsModal` component at `src/modules/reservations/components/RoomDetailsModal.tsx` — shows room status, current reservation details, upcoming reservation, full history table, loading/empty states
- [X] T026 [US5] Integrate room click handler in `RoomAvailabilityBoard` — clicking a room opens RoomDetailsModal, fetches from `/api/rooms/[id]/details-with-history`

**Checkpoint**: All 5 user stories independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: i18n, type correctness, validation, and hardening

- [X] T027 [P] Add English reservation i18n keys in `src/i18n/locales/en.json` — status labels, form labels, validation messages, toast messages, room status labels, history table headers
- [X] T028 [P] Add Arabic reservation i18n keys in `src/i18n/locales/ar.json` — same keys as English, with RTL-aware labels
- [ ] T029 Run `quickstart.md` validation scenarios — verify status transitions (12 cases), double booking (4 cases), pricing priority (5 cases), hold expiry (3 cases), payment consistency invariants
- [X] T30 Run full build: `npm run build` — fix any type errors, lint errors, or missing imports
- [ ] T31 Run Playwright E2E tests at `e2e/` — verify full walk-in booking flow works end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Description |
|-------|-----------|-------------|
| Phase 1 (Setup) | — | Can start immediately |
| Phase 2 (Foundational) | Phase 1 | Blocks ALL user stories |
| Phase 3 (US1, P1) | Phase 2 | Starts after Foundation |
| Phase 4 (US2, P2) | Phase 2 | Independent of US1 |
| Phase 5 (US3, P2) | Phase 2 | Independent of US1/US2 |
| Phase 6 (US4, P3) | Phase 2 | Independent of other stories |
| Phase 7 (US5, P3) | Phase 2 | Independent of other stories |
| Phase 8 (Polish) | Phases 3-7 | After all desired stories done |

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories — MVP scope
- **US2 (P2)**: No dependencies on other stories — uses shared foundation
- **US3 (P2)**: No dependencies on other stories — uses shared foundation
- **US4 (P3)**: No dependencies on other stories — uses shared foundation
- **US5 (P3)**: No dependencies on other stories — uses shared foundation

### Within Each Phase

- Tasks marked [P] can run in parallel within the same phase
- Sequential tasks must follow the listed order

---

## Parallel Opportunities

- Phase 2: T005 and T006 (bug fixes) can run in parallel
- Phase 3: T008 (hooks), T009 (pricing), T010 (badge) can run in parallel
- Phase 4-7: All user story phases can run in parallel once foundation is complete
- Phase 8: T027 and T028 (i18n) can run in parallel

## Parallel Example: User Story 1

```bash
# Launch all parallel tasks for US1 together:
Task: "Add missing client hook functions in src/modules/reservations/hooks/useReservations.ts"
Task: "Integrate pricing service into availability in src/modules/reservations/services/availabilityService.ts"
Task: "Create ReservationStatusBadge component in src/modules/reservations/components/ReservationStatusBadge.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T007 — blocks everything)
3. Complete Phase 3: User Story 1 (T008-T013)
4. **STOP and VALIDATE**: Manual test US1 flow end-to-end
5. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Deploy/Demo (MVP!)
3. Add US2 → Test independently → Deploy/Demo
4. Add US3 → Test independently → Deploy/Demo
5. Add US4 → Test independently → Deploy/Demo
6. Add US5 → Test independently → Deploy/Demo
7. Each story adds value without breaking previous stories

---

## Summary

- **Total tasks**: 31
- **Phase 1 (Setup)**: 1 task
- **Phase 2 (Foundational)**: 6 tasks
- **Phase 3 (US1 - P1)**: 6 tasks ← MVP
- **Phase 4 (US2 - P2)**: 4 tasks
- **Phase 5 (US3 - P2)**: 3 tasks
- **Phase 6 (US4 - P3)**: 3 tasks
- **Phase 7 (US5 - P3)**: 3 tasks
- **Phase 8 (Polish)**: 5 tasks
- **Parallel-ready tasks**: 8 marked [P]
- **Parallel-ready stories**: US1, US2, US3, US4, US5

### Suggested MVP Scope

User Story 1 only (T001-T013 = 13 tasks). Delivers: front desk can search availability, create individual reservation, check-in, check-out — the core hotel booking loop. Everything beyond this is incremental value.

### State at MVP

Backend is already 80%+ complete (23 service functions, 10 API routes, all types and validation). MVP primarily adds: migrations (schema must exist in DB), bug fixes, 3-4 frontend components, and reservation page wire-up.
