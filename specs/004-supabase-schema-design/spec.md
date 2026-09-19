# Feature Specification: Supabase Schema Design

**Feature Branch**: `004-supabase-schema-design`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Phase 2 — Supabase Schema Design from docs/plans/reservation_model_supabase_mcp_plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reservation Full Lifecycle (Priority: P1)

The front desk user can create a reservation with all essential data — check-in/out dates, room assignments, guest information, and booking type — and manage it through its lifecycle (draft, held, confirmed, checked in, checked out) while the system prevents double booking and enforces valid status transitions.

**Why this priority**: Reservation creation and lifecycle management is the core business function. Without it, the front desk cannot operate. All other features (billing, holds, notes) enhance this primary capability.

**Independent Test**: A user can create a reservation with dates and a room, confirm it, check the guest in, and check them out — and the system prevents assigning the same room to overlapping dates.

**Acceptance Scenarios**:

1. **Given** a new reservation, **When** the user enters check-in/out dates, selects a room, assigns a primary guest, and sets the booking type, **Then** the reservation is saved in draft status with a unique reservation number.
2. **Given** a confirmed reservation for a specific room and date range, **When** another user attempts to confirm a second reservation for the same room with overlapping dates, **Then** the system rejects the duplicate and shows the conflict.
3. **Given** a reservation in confirmed status, **When** the user checks the guest in, **Then** the reservation status changes to checked_in and the room is marked occupied.
4. **Given** a checked-in reservation, **When** the user checks the guest out, **Then** the reservation status changes to checked_out and the room is released.
5. **Given** an active reservation, **When** the user cancels it, **Then** the reservation status changes to cancelled and any assigned rooms are released.
6. **Given** a reservation with check-out date before check-in date, **When** the user attempts to save, **Then** the system rejects with a validation error.

---

### User Story 2 - Billing, Pricing & Company Support (Priority: P1)

The front desk user can set the billing party (guest, company, split, complimentary), apply company-specific pricing when the payer is a company, manually override prices with proper permission and audit trail, and record payments against reservations with balance tracking.

**Why this priority**: Hotel billing is complex — companies may pay for rooms without being the sleeping guest, prices must be explainable, overrides must be auditable. This is essential for daily operations.

**Independent Test**: A user can create a company reservation where the company is billed for the room while individual guests occupy it, override a price with a logged reason, record a payment, and see the balance update.

**Acceptance Scenarios**:

1. **Given** a company reservation, **When** the user sets the billing party to "company" and selects a company, **Then** the company is designated as the payer and can be invoiced separately from the guests.
2. **Given** a reservation with a company payer, **When** the system calculates pricing, **Then** company-specific pricing rules are applied (if configured) before falling back to standard rates.
3. **Given** a user with override permission, **When** they manually change a price, **Then** the old price, new price, reason, and user ID are recorded and the change is included in the audit trail.
4. **Given** a reservation with outstanding balance, **When** a payment is recorded, **Then** the paid amount increases and the balance decreases accordingly.
5. **Given** multiple pricing items on a reservation (room charges, taxes, services), **When** the user views the pricing breakdown, **Then** each item shows its amount, source, and any manual override details.

---

### User Story 3 - Room Holds, Notes & Status History (Priority: P2)

The front desk user can temporarily hold a room for a pending reservation with automatic expiry, add operational notes with visibility controls, and view a complete history of status changes for any reservation.

**Why this priority**: Room holds prevent availability conflicts during booking conversations. Notes and history improve operational coordination and dispute resolution. These are support features that enhance the core lifecycle (US1).

**Independent Test**: A user can hold a room, see it blocked from other reservations, have the hold expire and release the room automatically, add a note visible only to staff, and view a timestamped history of all status changes.

**Acceptance Scenarios**:

1. **Given** an active hold on a room, **When** another user searches available rooms, **Then** the held room is not shown as available and the hold is visible with responsible user and expiry time.
2. **Given** an active hold past its expiry time, **When** the system processes expired holds, **Then** the hold status changes from "active" to "expired" and the room becomes available again.
3. **Given** a reservation with an active hold, **When** the user confirms the reservation, **Then** the hold is converted to a reserved room assignment.
4. **Given** a confirmed reservation, **When** the user adds an internal note, **Then** the note is stored with the author, timestamp, and visibility setting.
5. **Given** a reservation with status changes, **When** the user views the history, **Then** each change shows from-status, to-status, who changed it, when, and why.

---

### Edge Cases

- What happens when a reservation is modified after initial creation? The system must support updating dates, rooms, guests, and pricing with re-validation of conflicts.
- What happens when a room needs to be changed mid-stay? The room assignment should support moves without cancelling the entire reservation.
- What happens when a reservation has split-stay (different rooms/dates for different segments)? Each stay segment maps to a reservation_room record.
- What happens when a company exceeds its credit limit? The system should flag or block further charges based on company configuration.
- What happens when a hold is released by a different user than who created it? The system should allow supervisory release with audit logging.
- What happens when a reservation has multiple payment methods (deposit in cash, balance by invoice)? Multiple payment records should be supported per reservation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support creating reservations with check-in date, check-out date, booking type (individual, company, group, travel_agent, internal), room count, guest count, and status.
- **FR-002**: System MUST support the reservation lifecycle: draft → held → confirmed → checked_in → checked_out, with alternative paths for cancellation, no-show, and expiry.
- **FR-003**: System MUST enforce that only confirmed reservations can be checked in, and only checked-in reservations can be checked out.
- **FR-004**: System MUST prevent double booking — no two active reservations may occupy the same room with overlapping dates.
- **FR-005**: System MUST support multiple rooms per reservation (one-to-many) with per-room check-in/out dates if split-stay is needed.
- **FR-006**: System MUST track room assignment status separately from reservation lifecycle (selected, held, reserved, occupied, checked_out, cancelled, released).
- **FR-007**: System MUST associate guests with reservations, designating one primary guest per individual booking and supporting additional guests with room assignments.
- **FR-008**: System MUST support company as payer separate from sleeping guests, with configurable billing terms (pay_on_arrival, invoice, credit) and credit approval.
- **FR-009**: System MUST support itemized pricing with source tracking (manual override → company override → seasonal rate → room-specific rate → room-type default rate).
- **FR-010**: Manual price override MUST require permission and MUST record old price, new price, reason, actor, and timestamp in the audit trail.
- **FR-011**: System MUST support payments (deposit, partial, full, refund, company_invoice, guarantee_only) with balance tracking (balance = total - paid).
- **FR-012**: System MUST support temporary room holds with configurable expiry, where active holds block availability and expired/released holds do not.
- **FR-013**: Converting a hold to a confirmed reservation MUST re-validate room availability before allowing the transition.
- **FR-014**: System MUST support operational notes per reservation with type (front_desk, housekeeping, maintenance) and visibility (internal, public).
- **FR-015**: System MUST track all reservation status changes in a history log with from_status, to_status, reason, who changed it, and when.

### Key Entities *(include if feature involves data)*

- **Reservations**: The core parent record containing booking dates, guest counts, booking type, status, and financial totals.
- **Reservation Rooms**: Links between a reservation and specific rooms, tracking per-room dates, status, pricing, and guest assignments.
- **Reservation Guests**: Guests associated with a reservation, with roles (primary, additional) and optional room assignment.
- **Reservation Company Info**: Company billing configuration for company reservations — payer, payment terms, credit, and billing scope.
- **Reservation Pricing Items**: Individual price line items with source tracking, base rate, applied rate, discounts, taxes, and manual override details.
- **Reservation Payments**: Payment records against a reservation — type, method, amount, status, and transaction reference.
- **Reservation Holds**: Temporary room locks with owner, dates, expiry, and status (active, expired, released, converted).
- **Reservation Notes**: Operational notes with type, visibility, message, and author.
- **Reservation Status History**: Immutable log of status changes with transition details and actor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A front desk user can complete the full reservation lifecycle (create → confirm → check-in → check-out) without encountering a database error or data inconsistency.
- **SC-002**: Double booking is prevented at the database level — two concurrent attempts to book the same room for overlapping dates cannot both succeed.
- **SC-003**: Company reservations correctly bill the company and track individual guests as room occupants without mixing payer and occupant data.
- **SC-004**: Manual price overrides are fully traceable — old price, new price, reason, and actor are retrievable for any overridden price.
- **SC-005**: Active holds reliably block room availability, and expired holds reliably release it within a configurable time window.
- **SC-006**: Reservation status history contains an unbroken, timestamped chain of all status transitions with actor attribution.

## Assumptions

- The existing database audit (spec 003) has been completed, and the decision to extend `bookings` or create new `reservations` is available as input to this phase.
- The system uses application-layer status transition enforcement with a documented transition map, not database CHECK constraints.
- Hold expiry duration is configurable per hotel policy with a default of 30 minutes.
- Pricing supports a single currency (USD) initially; multi-currency support is deferred.
- Room physical status (dirty, clean, maintenance) is tracked separately from reservation status and room assignment status — this schema handles reservation data only.
- All sensitive operations (price override, cancel, check-in/out) require permission checks at the application layer and write audit log entries.
