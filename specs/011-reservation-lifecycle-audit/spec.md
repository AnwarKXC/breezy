# Feature Specification: Reservation Lifecycle Services & Audit Logs

**Feature Branch**: `011-reservation-lifecycle-audit`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Phase 9 — Reservation Lifecycle Services - Phase 10 — Audit Logs from d:\ai-practise\hotel-system\docs\plans\reservation_model_supabase_mcp_plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Front Desk Manages Reservation Lifecycle (Priority: P1)

The front desk user can walk through the full reservation lifecycle: create a draft, hold rooms, confirm the reservation, check in the guest, and check out the guest. Each transition is validated against a strict state machine — invalid transitions (e.g., check-in from draft, check-out from confirmed) are blocked with a clear error message. Room availability is updated after each status change: confirmed reservations block rooms, checked-out reservations release rooms.

**Why this priority**: Without lifecycle management, a reservation is just data — it cannot be used for operations. The front desk needs to confirm, check in, and check out to run the hotel.

**Independent Test**: Create a draft reservation for Room 101. Confirm it — room appears as reserved in availability. Check in — room appears as occupied. Check out — room appears as dirty/released. Verify each step is recorded in the timeline.

**Acceptance Scenarios**:

1. **Given** a draft reservation, **When** the front desk confirms it, **Then** the status changes to `confirmed`, the reservation rooms' status changes to `reserved`, and the room blocks availability.
2. **Given** a confirmed reservation, **When** the front desk checks in the guest, **Then** the status changes to `checked_in`, the reservation rooms' status changes to `occupied`, and an audit log is written.
3. **Given** a checked-in reservation, **When** the front desk checks out the guest, **Then** the status changes to `checked_out`, the reservation rooms' status changes to `checked_out`, and the room is released for future bookings after housekeeping.
4. **Given** a reservation in `draft` status, **When** the front desk attempts to check in directly, **Then** the system blocks with "Cannot check in: reservation must be confirmed first."
5. **Given** a `checked_out` reservation, **When** the front desk attempts to cancel it, **Then** the system blocks with "Cannot cancel: reservation is already checked out."
6. **Given** a `confirmed` reservation, **When** the front desk cancels it, **Then** the status changes to `cancelled` and the room is released from blocking availability.

---

### User Story 2 - Audit Trail for Reservation Events (Priority: P2)

Every action on a reservation — creation, status change, room assignment, payment, price override, hold — is automatically recorded in the audit log with the actor, timestamp, before/after values, and relevant context (reservation number, guest name, room IDs). The audit log is read-only for all users except database admins. The front desk can view the complete audit timeline for any reservation from a single screen.

**Why this priority**: Audit logs are essential for compliance, dispute resolution, and operational accountability. Without them, there is no way to trace who did what and when.

**Independent Test**: Create a reservation, confirm it, and check in. The audit log shows three events: `reservation.created`, `reservation.confirmed`, `reservation.checked_in` — each with the acting user, timestamp, before/after status, and reservation number.

**Acceptance Scenarios**:

1. **Given** a new reservation is created, **When** the system persists it, **Then** an audit event `reservation.created` is written with the reservation ID, reservation number, status `draft`, and the creating user.
2. **Given** a reservation's status changes, **When** the transition completes, **Then** an audit event `reservation.<new_status>` is written with `old_status`, `new_status`, `changed_by`, and `changed_at`.
3. **Given** a room is assigned to a reservation, **When** the assignment completes, **Then** an audit event `room.assigned` is written with room ID and reservation ID.
4. **Given** a price is manually overridden, **When** the override is saved, **Then** an audit event `price.overridden` is written with old price, new price, reason, and actor.
5. **Given** a permission check fails during a lifecycle action, **When** the attempt is rejected, **Then** an audit event `permission.denied` is written with the attempted action, user, and target reservation.

---

### User Story 3 - Hold, Release, and Room Management (Priority: P3)

The front desk can place a temporary hold on one or more rooms for a draft reservation. Active holds block room availability for the held dates. Holds expire after a configurable duration (default 30 minutes), at which point they stop blocking availability. The front desk can also change a room assignment mid-stay (move guest to a different room) and extend or shorten a stay. Room changes and stay extensions recheck availability and prevent conflicts with other reservations.

**Why this priority**: Holds prevent double-booking during the reservation creation process. Room changes and stay extensions handle real-world hotel operations where plans change during a stay.

**Independent Test**: Hold Room 101 for a future date range. Verify it appears as unavailable during that range. Release the hold or let it expire — the room becomes available again. Confirm a reservation, then change the room — the new room is blocked, the old room is released.

**Acceptance Scenarios**:

1. **Given** a draft reservation, **When** the front desk places a hold on Room 101 for dates July 10–July 13, **Then** the hold is active and Room 101 shows as unavailable for those dates.
2. **Given** an active hold on Room 101, **When** the hold expires (reaches `expires_at` timestamp), **Then** the hold status changes to `expired` and Room 101 becomes available again.
3. **Given** a confirmed reservation with Room 101 checked in, **When** the front desk changes the room to Room 102, **Then** Room 101 is released, Room 102 is assigned, and the change is recorded in the audit log.
4. **Given** a confirmed reservation checking out July 13, **When** the front desk extends the stay to July 15, **Then** the system checks availability for the extension dates and either applies the extension or blocks with a conflict warning.
5. **Given** an active hold owned by User A, **When** User B attempts to hold the same room for overlapping dates, **Then** the system blocks with "Room is currently held by another user."

---

### Edge Cases

- What happens when two users attempt to confirm the same room simultaneously? The transactional RPC should prevent double booking — one succeeds, the other fails with a conflict error.
- What happens when a hold expires between the time the user selects a room and clicks confirm? The confirmation should revalidate all holds — expired holds trigger a "hold expired, please reselect room" message.
- What happens when a checked-in guest no-shows? The front desk can mark the reservation as `no_show` if the guest never arrives, releasing the room and triggering configured no-show policy (e.g., charge first night).
- What happens when a stay extension conflicts with a future confirmed reservation on the same room? The system must block the extension and show which future reservation conflicts.
- What happens when the audit log write fails during a critical operation (confirm, check-in, check-out)? The entire operation should roll back — a confirmed reservation without an audit trail is unacceptable.
- What about concurrent room change requests? The system should lock the reservation row and the affected room rows during the operation.
- What happens when audit event storage grows over time? Events older than 12 months are automatically purged after archival to prevent unbounded storage growth.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce a strict status transition map: `draft → [held, confirmed, cancelled]`, `held → [confirmed, expired, cancelled]`, `confirmed → [checked_in, cancelled, no_show]`, `checked_in → [checked_out]`, `checked_out → []`, `cancelled → []`, `no_show → []`, `expired → []`.
- **FR-002**: System MUST provide lifecycle service methods for: creating a draft reservation; updating a draft; holding rooms; releasing holds; confirming a reservation; cancelling a reservation; marking no-show; checking in; checking out; changing a room assignment; extending a stay; and recalculating pricing (as a stub method with permission checks and delegation to the existing pricing module — pricing logic implementation is out of scope for this phase).
- **FR-003**: Confirmation MUST revalidate all holds, check for room availability conflicts, validate pricing, validate payment/deposit rules, and perform all updates inside a single transaction — if any validation fails, the entire operation rolls back.
- **FR-004**: Check-in MUST require the reservation status to be `confirmed`. It MUST update the reservation status to `checked_in` and the reservation rooms' status to `occupied`.
- **FR-005**: Check-out MUST require the reservation status to be `checked_in`. It MUST update the reservation status to `checked_out`, the reservation rooms' status to `checked_out`, and trigger the room's housekeeping status change.
- **FR-006**: Cancellation MUST release all held or reserved rooms immediately. Cancellation MUST be allowed only from `draft`, `held`, or `confirmed` status.
- **FR-007**: Room holds MUST have an `expires_at` timestamp and a configurable default duration (default 30 minutes). Active holds MUST block room availability. Expired holds MUST NOT block availability.
- **FR-008**: Active holds MUST be revalidated before confirming a reservation. If a hold has expired, the confirmation MUST fail with a message indicating which room's hold expired.
- **FR-009**: Room change (move guest to a different room) MUST recheck availability for the new room and release the old room. Both operations MUST occur in a single transaction.
- **FR-010**: Stay extension MUST recheck room availability for the extension dates. If a conflict exists with another active reservation or hold, the extension MUST be blocked with details of the conflicting reservation.
- **FR-011**: The system MUST support manual `no_show` marking by authorized users. No-show MUST require the reservation to be in `confirmed` status. No-show MUST only be markable after a configurable grace period following the scheduled check-out time (default 2 hours).
- **FR-012**: Every lifecycle action MUST write an audit log event before or during the transaction. If the audit log write fails, the operation MUST roll back.
- **FR-013**: Audit events MUST record: event type, reservation ID, reservation number, actor user ID, timestamp, and event-specific metadata (old/new status for status changes, old/new room for room changes, old/new price for price overrides, etc.).
- **FR-014**: Required audit event types MUST include: `reservation.created`, `reservation.updated`, `reservation.held`, `reservation.confirmed`, `reservation.cancelled`, `reservation.checked_in`, `reservation.checked_out`, `reservation.no_show`, `room.assigned`, `room.changed`, `room.released`, `price.calculated`, `price.overridden`, `payment.recorded`, `payment.refunded`, `conflict.prevented`, `permission.denied`, `hold.created`, `hold.expired`, `hold.released`.
- **FR-015**: Permission-denied events MUST be recorded in the audit log even when the action does not proceed. This includes the attempted action, user, target, and reason.
- **FR-016**: The audit log MUST be append-only and immutable for non-admin users. No front desk or management user interface should allow deleting or modifying audit entries.
- **FR-017**: Each lifecycle service method MUST check the user's action permission before executing. Permission-to-role mapping follows a two-tier model:
  - **Front desk tier**: `reservation:create`, `reservation:read`, `reservation:update`, `reservation:confirm`, `reservation:check_in`, `reservation:check_out`, `reservation:record_payment`.
  - **Manager/admin tier** (all front desk permissions plus): `reservation:cancel`, `reservation:override_price`, `reservation:override_deposit`, `reservation:force_assign_room`, `reservation:assign_dirty_room`, `reservation:assign_maintenance_room`, `reservation:company_credit_override`, `reservation:refund_payment`.
- **FR-018**: The audit log for a reservation MUST be queryable and filterable by event type, date range, and actor.
- **FR-019**: Expired holds MUST be cleaned up via a scheduled job or inline check during availability queries. The cleanup sets the hold status to `expired` and records an `hold.expired` audit event.
- **FR-020**: Audit events older than 12 months MUST be automatically purged after archival. The system MUST retain a permanent archival record before deletion. The purge schedule MUST be configurable.

### Key Entities *(include if feature involves data)*

- **Reservation Status**: Lifecycle state of a reservation (`draft`, `held`, `confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show`, `expired`). Governed by a strict transition map.
- **Reservation Room Status**: Assignment state of a specific room within a reservation (`selected`, `held`, `reserved`, `occupied`, `checked_out`, `cancelled`, `released`). Independent from room physical status.
- **Reservation Hold**: Temporary room lock attached to a draft reservation. Key attributes: room_id, held_by_user_id, check_in_date, check_out_date, expires_at, status (active/expired/released).
- **Reservation Status History**: Chronological log of status changes per reservation. Key attributes: from_status, to_status, reason, changed_by, changed_at.
- **Audit Event**: Immutable record of any important reservation action. Key attributes: event_type, reservation_id, reservation_number, actor_id, metadata (JSON), timestamp. Event types defined by a controlled vocabulary of ~20 event types.
- **Audit Log**: Aggregated view of audit events across all reservations. Queryable by reservation, event type, date range, and actor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A front desk user can complete the full lifecycle (create draft → confirm → check-in → check-out) for a single reservation in under 2 minutes from a single screen, with feedback after each action.
- **SC-002**: All 20 status transitions defined in the transition map are tested — valid transitions succeed, invalid transitions fail with a clear message. Zero invalid transitions succeed in any test run.
- **SC-003**: Double booking is prevented under concurrent access — verified by firing two simultaneous confirmation requests for the same room at the same time slot; exactly one succeeds and one fails.
- **SC-004**: Every audit event type is verified by test — all 20+ event types are recorded at least once across the test suite. Audit events contain the correct actor, timestamp, and context metadata.
- **SC-005**: Expired holds no longer block availability — verified by creating a hold with a 1-minute expiry, waiting for expiry, and confirming the room appears available for the same dates.
- **SC-006**: Room change and stay extension correctly re-check availability — verified by attempting a room change to an already-occupied room and a stay extension that conflicts with a future booking; both are blocked with specific conflict details.
- **SC-007**: The system supports up to 20 concurrent front desk users performing lifecycle actions without degradation — verified by load testing with 20 simultaneous confirmation/check-in/check-out requests.

## Assumptions

- The existing reservation model (`reservations`, `reservation_rooms`, `reservation_holds`, `reservation_status_history`) is already created by previous phases.
- The existing `reservation_status_history` table is extended or reused for lifecycle tracking — no duplicate history storage is created.
- Audit logging reuses or extends the existing project audit/log system rather than creating a new one.
- Permission checking uses the existing RBAC system; lifecycle service methods check permissions via existing patterns.
- Hold expiry cleanup runs as a scheduled check (either Supabase cron job or inline during availability queries).
- No-show behavior: manual action by front desk staff with permission after a configurable grace period following scheduled checkout time (default 2 hours); no automatic no-show detection in this phase.
- Stay extension: re-pricing on extension is handled by a separate pricing recalculation service (not in scope for this phase). The lifecycle service provides a stub method for `recalculateReservationPricing` with permission checks and delegation to the pricing module — no pricing logic is built here.
- Room change mid-stay does not trigger re-pricing unless pricing is explicitly recalculated via the stub method.
- Audit events are written synchronously as part of the lifecycle transaction — no async queue is introduced for audit writes in this phase.
- The system must support partial availability queries during hold revalidation — if one room in a multi-room reservation has an expired hold, only that room needs re-selection.
- Audit logs follow a 1-year rolling retention with indefinite archival — events older than 1 year are automatically purged after archival.
- The system must support up to 20 concurrent front desk users performing lifecycle actions simultaneously without degradation.

## Clarifications

### Session 2026-06-28

- Q: What is the audit log retention policy? → A: 1 year rolling retention with indefinite archival. Events older than 1 year are automatically purged after archival.
- Q: Is the `recalculateReservationPricing` method in scope for this phase? → A: Stub method only — create the service method signature with permission checks and delegation to the existing pricing module; pricing logic itself is out of scope.
- Q: What is the no-show marking window? → A: Configurable grace period after scheduled checkout time (default 2 hours).
- Q: How many concurrent front desk users should the system support? → A: Up to 20 concurrent users.
- Q: How should permissions map to roles for lifecycle actions? → A: Adopt the two-tier mapping from Phase 4 — front desk (create/read/update/confirm/check_in/check_out/record_payment) and manager/admin (all above plus cancel/override_price/force_assign_room/assign_dirty_or_maintenance_room/refund_payment/company_credit_override).
