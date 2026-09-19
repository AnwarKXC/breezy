# Feature Specification: Reservation Creation and Hold Flow

**Feature Branch**: `008-reservation-creation-flow`

**Created**: 2026-06-28

**Status**: Clarified

**Input**: User description: "Phase 6 — Reservation Creation and Hold Flow from d:\ai-practise\hotel-system\docs\plans\reservation_model_supabase_mcp_plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draft Reservation with Room Holds (Priority: P1)

The front desk user can create a draft reservation by entering guest information, check-in/out dates, and selecting rooms. Upon saving the draft, the system creates active holds on the selected rooms so that no other user can book them while the reservation is being completed.

**Why this priority**: Room holds are the foundation of the booking workflow. Without holds, two front desk agents could simultaneously select the same room for different guests, leading to double-booking conflicts at confirmation time.

**Independent Test**: A front desk agent enters guest details, dates, and selects two rooms. The system creates a draft reservation with status `draft` and two active holds with 30-minute expiry. Another agent querying availability for those rooms sees them as held with conflict type `active_hold`.

**Acceptance Scenarios**:

1. **Given** a front desk user has entered guest details, check-in/out dates, and selected available rooms, **When** they save the draft, **Then** the system creates a reservation with status `draft` and creates an active hold for each selected room.
2. **Given** a room has an active hold owned by the current user, **When** they query availability, **Then** the room shows as held with `canSelect = true` (same-user hold is selectable).
3. **Given** a room has an active hold owned by another user, **When** any user queries availability, **Then** the room shows as held with `canSelect = false` and conflict type `active_hold`.
4. **Given** a room with an active hold that has expired, **When** any user queries availability, **Then** the room shows as available (expired holds do not block).

---

### User Story 2 - Hold Lifecycle Management (Priority: P2)

The system manages room hold lifecycles automatically. Holds expire after a configurable period. Front desk users can manually release holds on rooms. Expired or released holds free the room for other reservations.

**Why this priority**: Without automatic expiry, abandoned draft reservations would permanently block rooms. Manual release is needed when a guest decides not to proceed.

**Independent Test**: A hold is created with 10-minute expiry. After 10 minutes, the hold status changes to `expired` and the room becomes available for other bookings. A front desk user can also manually release a hold, making the room available immediately.

**Acceptance Scenarios**:

1. **Given** an active hold, **When** the hold expiry time is reached, **Then** the hold status changes to `expired` and the room becomes available in availability queries.
2. **Given** an active hold owned by the current user, **When** the user releases the hold, **Then** the hold status changes to `released` and the room becomes available immediately.
3. **Given** an active hold owned by another user, **When** the current user attempts to release it, **Then** the system rejects the action with a permission error.
4. **Given** an expired hold, **When** any user attempts to confirm a reservation using it, **Then** the system rejects confirmation and asks the user to re-select the room.

---

### User Story 3 - Reservation Confirmation with Conflict Re-validation (Priority: P3)

The front desk user can confirm a draft reservation. Before confirming, the system re-validates all selected rooms for date conflicts, hold validity, and pricing consistency. On success, the reservation status changes to `held` or `confirmed`, holds convert to room assignments, and audit logs are written.

**Why this priority**: Confirmation is the business-critical operation that converts a draft into a binding reservation. Atomic re-validation prevents double-booking and ensures data integrity.

**Independent Test**: A draft reservation with two rooms is confirmed. Both active holds are converted to reservation room assignments with status `held`. Audit log entries are created for the confirmation. If a conflict is detected during re-validation, the entire operation is rolled back and the user is informed which rooms have conflicts.

**Acceptance Scenarios**:

1. **Given** a draft reservation with valid holds and no date conflicts, **When** the user confirms, **Then** the reservation status changes to `held`, holds become room assignments with status `held`, and audit log entries are written.
2. **Given** a draft reservation where a hold has expired, **When** the user confirms, **Then** the system rejects confirmation and indicates which rooms need to be re-selected.
3. **Given** a draft reservation where another reservation now overlaps the selected dates, **When** the user confirms, **Then** the system rejects confirmation with conflict details.
4. **Given** a draft reservation where the selected room is now under maintenance, **When** the user confirms, **Then** the system rejects confirmation and suggests alternative rooms.
5. **Given** a successful confirmation, **When** an admin checks the audit log, **Then** they see entries for the status change, room assignments, and the acting user.

---

### Edge Cases

- What happens when two front desk users simultaneously try to hold the same room? The second user's hold request should fail with a conflict error.
- What happens when a user confirms a reservation that was updated by another user? The system should re-validate the current state before confirming.
- What happens when the system crashes between creating holds and confirming? Draft reservations should remain recoverable — the front desk can see their drafts and retry confirmation.
- What happens when a hold expiry is configured to 0 minutes? Holds should behave as instant bookings (hold + confirm in one step effectively).
- What happens when a guest wants to modify room selection after draft is saved? The user should be able to release one hold and create a new hold for a different room without losing the rest of the draft data.
- What happens when the reservation already has confirmed payments and the user tries to modify dates? The system should prevent date changes after payment is registered (out of scope for this phase, but guard against it).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow front_desk and admin users to create a draft reservation with guest details, check-in/out dates, selected rooms, and optional notes. Accountant users are read-only and cannot create drafts.
- **FR-002**: System MUST create an active hold for each selected room when saving a draft reservation. Each hold MUST reference the parent reservation via a non-null `reservation_id` foreign key.
- **FR-003**: Each hold MUST have a configurable expiry period (default 30 minutes) stored in the reservation_holds table.
- **FR-004**: System MUST prevent creation of a hold on a room that already has an active hold owned by a different user.
- **FR-005**: System MUST allow the hold owner (front_desk or admin) to release a hold, changing its status to `released`.
- **FR-006**: System MUST automatically expire holds whose `expires_at` timestamp has passed.
- **FR-007**: System MUST re-validate all selected rooms for date conflicts, hold validity, and room physical status before confirming a reservation.
- **FR-008**: System MUST confirm a reservation inside a single atomic transaction that: re-validates all conditions, converts ALL holds to room assignments (status `held`), updates reservation status to `held`, writes status history, and writes audit log entries. Confirmation is all-or-nothing — partial confirmations are not supported.
- **FR-009**: System MUST reject confirmation if ANY re-validation check fails, rolling back the entire transaction and reporting which rooms failed.
- **FR-010**: System MUST check user permissions before allowing hold creation, hold release, and reservation confirmation. front_desk and admin users have full access to create, release, confirm. Accountant users have read-only access to drafts and holds but cannot create, modify, or confirm.
- **FR-011**: System MUST write audit log entries for: draft creation, hold creation, hold release, hold expiry, and reservation confirmation.
- **FR-012**: System MUST prevent hold creation or confirmation on rooms with status `maintenance` or `out_of_order`.
- **FR-013**: System MUST allow the user to modify draft reservation details (guest info, dates, rooms) without losing existing data, as long as no confirmation has occurred.

### Key Entities *(include if feature involves data)*

- **Reservations** — Parent reservation record. Holds `draft` status during creation, transitions to `held` or `confirmed` on confirmation.
- **Reservation Rooms** — Room assignment records. Created from holds during confirmation with status `held`.
- **Reservation Holds** — Temporary room locks with: room_id, check_in_date, check_out_date, status (active/expired/released), expires_at timestamp, created_by user reference, reservation_id (FK to draft reservation, NOT NULL — holds always require a parent reservation).
- **Reservation Status History** — Lifecycle tracking for the reservation state machine. One entry per status transition.
- **Audit Log** — Entries for all sensitive operations (existing logs system).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Front desk users can create a draft reservation with holds in under 60 seconds from starting the form.
- **SC-002**: Expired holds no longer appear as blocking in availability queries within 1 second of their expiry time.
- **SC-003**: Conflicting hold requests (two users same room) are correctly rejected 100% of the time, verified with concurrent test scenarios.
- **SC-004**: Reservation confirmation with conflict re-validation completes in under 3 seconds for up to 5 selected rooms.
- **SC-005**: The atomic confirmation RPC either fully succeeds (all holds converted, status updated, audit written) or fully fails with clear error messages — no partial state.

## Assumptions

- The existing `reservations`, `reservation_rooms`, `reservation_holds`, `reservation_status_history`, and audit log tables already exist from Phase 2 data model deployment.
- The existing `get_room_availability` RPC (enhanced in Phase 7) already returns hold conflicts with `active_hold` conflict type.
- Front desk is the primary user — this is an internal tool, not a public-facing booking engine.
- Hold expiry is a soft timeout (expired holds are not immediately cleaned up, just filtered as inactive in queries).
- Hold duration is configurable per hotel policy — the system stores the configured duration but does not require a UI for it in this phase.
- The existing RBAC/action-permission system is used for all permission checks.
- front_desk and admin roles can create, release, and confirm reservations. Accountant role is read-only for this feature.
- This phase is backend RPC + migration only. UI components are deferred to a separate phase.
- Payment capture happens in a later phase — confirmation does not require payment.
- Concurrent access is handled via PostgreSQL transaction isolation (REPEATABLE READ or SERIALIZABLE where needed).
- Confirmation is all-or-nothing — partial room confirmation requires the user to release unwanted rooms first, then confirm the remainder as a separate operation.

## Clarifications

### Session 2026-06-28

- Q: Can holds exist without a parent reservation? → A: No — holds always require a reservation_id (NOT NULL). Guest details must be entered first.
- Q: Which roles can perform hold/confirm operations? → A: front_desk and admin = full access (create, hold, release, confirm). Accountant = read-only.
- Q: Can a user confirm only some rooms from a multi-room draft? → A: No — all-or-nothing. Partial confirmation requires releasing unwanted holds first then confirming the rest.
