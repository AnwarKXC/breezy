# Feature Specification: Room Click Details Modal & Final Acceptance

**Feature Branch**: `016-room-details-modal`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Phase 17 — Final Acceptance Criteria & Recommended Agent Execution Prompt & Recommended File Map & Add-on Phase — Room Click Details Modal and Room History Table & Top reservation/status summary cards & the rest of the plan from phase 17 until the end"

## User Scenarios & Testing

### User Story 1 — Room Click Details Modal (Priority: P1)

When a front desk staff member clicks any room from the availability board, room rack, calendar, or room list, a read-only details modal opens showing the current reservation data, room status, future booking information, and a history table. The modal opens for every room state — not only occupied rooms.

**Why this priority**: Front desk staff need to quickly answer operational questions about any room without navigating away from their current view. This is the primary decision-making interface for room assignments during check-in.

**Independent Test**: Click a room from the availability board — modal opens showing room header, status summary cards, and history table. Repeat for all room states (available, occupied, held, dirty, maintenance, blocked, etc.).

**Acceptance Scenarios**:

1. **Given** a room card in the availability board, **When** user clicks the room, **Then** a modal opens showing the room number, type, floor, capacity, and current status.
2. **Given** a room with an active checked-in reservation, **When** the modal opens, **Then** the current reservation card shows reservation number, guest name, company (if applicable), check-in/out dates, nights, billing party, payment status, balance, and special requests.
3. **Given** a room with a future booking but no current occupant, **When** the modal opens, **Then** the next reservation card shows the future guest, arrival date, departure date, and reservation status.
4. **Given** a room that is held but not confirmed, **When** the modal opens, **Then** the hold details show the holding staff member and expiry time.
5. **Given** a room that is available (clean, no reservations), **When** the modal opens, **Then** the availability card shows the room is available now and lists the next future booking date if one exists.
6. **Given** a room that is dirty after checkout, **When** the modal opens, **Then** the room status card shows dirty status and the last checkout time.
7. **Given** a room in maintenance or out-of-order, **When** the modal opens, **Then** the room status shows the blocking reason and the modal does not allow selection for booking.

---

### User Story 2 — Room History Table (Priority: P2)

Within the room details modal, a history table shows all events that occurred for this room — reservations, status changes, housekeeping, maintenance, holds, and assignments — in chronological order with the most recent events first.

**Why this priority**: Staff need to understand a room's history to explain charges, resolve disputes, and audit room usage. The history table consolidates information from multiple sources into one view.

**Independent Test**: Open the modal for a room with multiple historical events — the history table shows events from reservations, housekeeping, and room status changes with correct dates, event types, and actors.

**Acceptance Scenarios**:

1. **Given** a room that was assigned, occupied, cleaned, and reassigned, **When** the history table loads, **Then** events are listed in reverse chronological order with columns: Date/Time, Event Type, Reservation No., Guest/Company, Room Status, Reservation Status, Check-in, Check-out, Action By, Notes.
2. **Given** a room with no events, **When** the modal opens, **Then** the history table shows a message indicating no history records exist.
3. **Given** a room with events from multiple sources (reservations, housekeeping, maintenance), **When** the history table loads, **Then** events from all sources are combined into a single timeline.
4. **Given** historical (cancelled, checked-out, no-show) reservation events, **When** the history table displays them, **Then** they are labeled clearly as historical and do not indicate an active block on the room.

---

### User Story 3 — Final Acceptance Criteria Verification (Priority: P3)

An administrator or QA tester verifies that the complete reservation model meets all defined acceptance criteria — from reservation creation through check-out, including company billing, conflict prevention, audit logging, and room availability. This confirms the entire reservation model implementation is complete.

**Why this priority**: Acceptance criteria verification is the final gate before declaring the reservation model feature-complete. It validates that all previous phases delivered correct, integrated functionality.

**Independent Test**: Execute the acceptance checklist — all 26 criteria pass with demonstrable evidence (screenshots, MCP query results, API responses).

**Acceptance Scenarios**:

1. **Given** the full reservation system deployed, **When** an individual reservation is created and confirmed, **Then** the reservation is persisted with correct data and status.
2. **Given** a company reservation, **When** created with company as payer, **Then** guests are assigned to rooms and the company pays.
3. **Given** two users attempt to confirm the same room on overlapping dates, **When** both confirmations are processed, **Then** only one succeeds and the other is prevented (no double booking).
4. **Given** a manual price override is applied, **When** the override is saved, **Then** an audit log entry is created recording the change, the actor, and the reason.
5. **Given** a reservation cancellation, **When** cancelled, **Then** the room is released and becomes available for future booking.

### Edge Cases

- What happens when the room's data is loading and the user closes the modal before it finishes?
- How does the modal handle a room that has both a current reservation AND a future booking?
- What if the room history contains thousands of events — is there pagination or a date range filter?
- What happens when a room status changes (e.g., housekeeping marks it clean) while the modal is open?
- How does the modal display a room with conflicting data (e.g., room marked occupied but no active reservation exists)?

## Requirements

### Functional Requirements

**Room Details Modal:**

- **FR-001**: Clicking any room card in the availability board, room rack, calendar, or room list MUST open a read-only details modal.
- **FR-002**: The modal header MUST display room number, room type name, floor, capacity, and current physical room status.
- **FR-003**: The modal MUST open for every room state: available, occupied, confirmed, held, due-in, due-out, dirty, clean, inspected, maintenance, out-of-order, blocked, and partially available.
- **FR-004**: For occupied rooms, the modal MUST show a current reservation summary card with reservation number, guest name, company (if applicable), check-in/out dates, nights, billing party, payment status, and balance.
- **FR-005**: For held (not confirmed) rooms, the modal MUST show hold details including holding staff member, expiry time, and draft reservation number if available.
- **FR-006**: For rooms with future bookings, the modal MUST show a next reservation card with future guest/company, arrival date, departure date, and reservation status.
- **FR-007**: The modal MUST include a room availability card showing whether the room is available now, available from/to dates, unavailable reason, and whether it can be selected for a current date range search.
- **FR-008**: For rooms marked dirty, cleaning, or needing inspection, the modal MUST show the last checkout time and cleaning status.
- **FR-009**: For rooms in maintenance or out-of-order, the modal MUST show the blocking reason and prevent selection for booking unless the user has override permission.
- **FR-010**: The modal MUST fetch data via a server-side API (e.g., `GET /api/rooms/:id/details-with-history`) that combines room details, current reservation, future reservation, and availability into a single response.

**Room History Table:**

- **FR-011**: Under the summary cards, the modal MUST include a room history table showing all events for this room.
- **FR-012**: The history table columns MUST include: Date/Time, Event Type, Reservation Number, Guest/Company, Room Status, Reservation Status, Check-in, Check-out, Action By, Notes.
- **FR-013**: Events MUST be displayed in reverse chronological order (most recent first).
- **FR-014**: The history table MUST combine events from multiple data sources: reservations, reservation_rooms, reservation_status_history, reservation_holds, reservation_notes, audit_logs, room_status_history, housekeeping records, and maintenance records.
- **FR-015**: Historical events (cancelled, checked-out, no-show) MUST be visually distinguished from active events.
- **FR-016**: The history table MUST support pagination or date-range filtering to handle rooms with many historical events.
- **FR-017**: If no history records exist for a room, the table MUST display an empty state message.

**Final Acceptance Criteria:**

- **FR-018**: An individual reservation MUST be creatable and confirmable with all required data persisted correctly.
- **FR-019**: A company reservation MUST be creatable and confirmable with the company as payer while guests are assigned to rooms.
- **FR-020**: Multi-room reservations MUST be supported within a single reservation.
- **FR-021**: Room availability MUST show available, booked, occupied, due-out, dirty, maintenance, and partially available rooms correctly.
- **FR-022**: Active holds MUST block room availability; expired holds MUST NOT block availability.
- **FR-023**: Double booking MUST be prevented by backend or database logic when two confirmations attempt the same room on overlapping dates.
- **FR-024**: Pricing MUST be explainable by pricing source (manual override, company override, seasonal rate, room-type default).
- **FR-025**: Manual price override MUST require permission and MUST write an audit log entry.
- **FR-026**: Payments MUST update the reservation paid amount and balance correctly.
- **FR-027**: Reservation status transitions MUST follow the defined transition map strictly (no invalid transitions allowed).
- **FR-028**: Room operational status and reservation status MUST remain separate — a room can be dirty while the reservation is checked-out.
- **FR-029**: Cancellation MUST release all assigned rooms.
- **FR-030**: Audit or activity log entries MUST be written for all sensitive reservation actions.

### Key Entities

- **Room Details Modal**: A UI modal that displays comprehensive information about a room — status, reservations, availability, and history — accessed by clicking a room card.
- **Room History Table**: A table within the modal that displays chronological events for a room sourced from reservations, housekeeping, maintenance, and audit logs.
- **Room Summary Cards**: Visual cards showing current state — room status, current reservation, next reservation, and availability.
- **Acceptance Criteria**: A set of 26 verifiable statements that, when all true, confirm the reservation model implementation is complete.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The room details modal opens within 1 second of clicking a room card on any view (availability board, room rack, calendar).
- **SC-002**: The room history table loads and renders within 2 seconds for rooms with up to 500 historical events.
- **SC-003**: The modal correctly displays all 12 room states with the appropriate summary cards and information.
- **SC-004**: 100% of the 26 final acceptance criteria pass when verified against the deployed system.
- **SC-005**: Staff can answer the question "who is in this room now and what happened to it before?" for any room in under 5 seconds using the modal.

## Assumptions

- The existing reservation model schema, services, API routes, and seed data (from phases 1–15) are already deployed.
- Room cards in the availability board, room rack, and calendar already exist and support click handlers.
- The `GET /api/rooms/:id/details-with-history` endpoint will be used to fetch all modal data in a single request.
- Room history is sourced from existing tables (reservations, reservation_rooms, reservation_status_history, reservation_holds, reservation_notes, audit_logs, room_status_history) — no new data storage tables are required.
- The modal is read-only — no edits, creates, or deletes happen within the modal.
- Housekeeping and maintenance records are available in the existing room_status_history and audit_logs tables.
- The modal UI follows existing project design patterns (Tailwind CSS, component architecture from contacts/rooms modules).
