# Feature Specification: Reservation Data Model

**Feature Branch**: `001-reservation-data-model`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Implement a hotel reservation data model that supports
individual, company, and group bookings, multi-room reservations, room holds,
availability checks, pricing overrides, payments, and room history, following
the plan in docs/plans/reservation_model_supabase_mcp_plan.md."

## Clarifications

### Session 2026-06-28

- Q: Extend existing `bookings` table or create new `reservations` table? → A: Extend existing `bookings` table to serve as the reservation parent; create new sub-tables (`reservation_rooms`, `reservation_guests`, etc.) where they don't exist.
- Q: Expected data volume and scale? → A: Medium scale (30-100 rooms, 50-200 reservations/day, 10-30 concurrent front desk users).
- Q: Error and loading state behavior? → A: Toast notifications for success/transient errors, inline field validation for form issues.
- Q: Reservation number format? → A: Sequential prefixed format (RSV-1001, RSV-1002, ...).
- Q: Housekeeping status management scope? → A: Out of scope for this feature. Checkout marks dirty, staff manually clears status. No housekeeping workflow module.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Front Desk Creates and Manages Individual Reservation (Priority: P1)

A front desk staff member needs to check a walk-in guest into the hotel. They
search for available rooms, select a room, create the reservation, and later
check the guest in and out. The system must prevent accidentally double-booking
a room.

**Why this priority**: This is the most frequent daily operation at any hotel
front desk. Without it, the system cannot serve its primary purpose.

**Independent Test**: Can be fully tested by searching room availability for
dates, selecting a room, creating a confirmed reservation, checking the guest
in, checking them out, and verifying the room is released for future booking.

**Acceptance Scenarios**:

1. **Given** a walk-in guest arrives, **When** the front desk searches
availability for tonight, **Then** available rooms are shown with capacity,
room type, price, and current room status.

2. **Given** available rooms are shown, **When** the front desk selects a room
and enters guest details, **Then** the reservation is created in confirmed
status and that room is no longer shown as available for those dates.

3. **Given** a guest is checked in, **When** the front desk checks them out,
**Then** the reservation status changes to checked out and the room is marked
dirty for housekeeping.

4. **Given** two front desk staff attempt to book the same room for overlapping
dates at the same time, **When** both submit, **Then** only one succeeds and
the other sees a conflict error.

---

### User Story 2 - Company Booking with Multi-Room Support (Priority: P2)

A company representative books multiple rooms for employees attending a
conference. The company is the payer but employees are the sleeping guests.
Employee names may be provided later. The company rate override must apply
automatically.

**Why this priority**: Company bookings generate higher revenue per reservation
and are common in business hotels. Supporting this distinguishes a professional
hotel system from a basic one.

**Independent Test**: Can be tested by creating a company reservation with
multiple rooms, assigning different guest names to different rooms, verifying
company rate applies, and checking the billing party is the company.

**Acceptance Scenarios**:

1. **Given** a company contact exists with a negotiated rate,
**When** a front desk creates a company reservation for 3 rooms over 2 nights,
**Then** the company rate override is applied and billing party is set to
company.

2. **Given** a company reservation with guest names pending,
**When** the front desk adds guest names later, **Then** each guest is
associated with their assigned room and the reservation remains confirmed.

3. **Given** a company reservation is checked out,
**When** the accounting department views billing, **Then** all room charges
are attributed to the company with itemized pricing per room.

---

### User Story 3 - Room Hold with Expiry and Conflict Prevention (Priority: P2)

A potential guest calls asking the front desk to hold a room while they decide.
The hold must block availability for a configurable time (e.g., 30 minutes),
then expire automatically. If the guest confirms, the hold converts to a
confirmed reservation.

**Why this priority**: Holds are essential for phone inquiries and reducing
lost bookings. Automated expiry prevents rooms from being blocked indefinitely.

**Independent Test**: Can be tested by creating a hold on a room, verifying it
blocks availability, waiting for expiry (or simulating it), and confirming the
room is available again.

**Acceptance Scenarios**:

1. **Given** a room is available, **When** a hold is created for that room
with a 30-minute expiry, **Then** the room shows as held and is not selectable
by other staff.

2. **Given** a hold has expired, **When** another staff searches availability,
**Then** the room appears available again.

3. **Given** an active hold exists, **When** the original staff confirms the
reservation, **Then** the hold converts to a confirmed room assignment.

---

### User Story 4 - Manual Price Override with Audit Trail (Priority: P3)

A manager needs to override the room price for a VIP guest or to match a
competitor's rate. The override must require specific permission, record who
changed what, log the reason, and be visible in the reservation audit trail.

**Why this priority**: Price overrides are less frequent but high-risk for
revenue accuracy. Proper controls prevent unauthorized discounts.

**Independent Test**: Can be tested by applying a manual price override,
verifying the new price is used in billing, and confirming the audit log
contains the old price, new price, reason, and actor.

**Acceptance Scenarios**:

1. **Given** a front desk user without override permission, **When** they
attempt to change the price, **Then** the system denies the action.

2. **Given** a manager with override permission, **When** they enter a new
price with a reason, **Then** the reservation pricing updates and an audit
log entry is created with old price, new price, reason, and manager identity.

---

### User Story 5 - Room Details and History View (Priority: P3)

A front desk or manager clicks on any room from the availability board and sees
a modal with the room's current status, current/next reservation details, and a
full history table of everything that happened to that room.

**Why this priority**: Quick access to room intelligence improves operational
efficiency at the front desk.

**Independent Test**: Can be tested by clicking an occupied room and seeing
current guest info, and clicking a room with no reservation and seeing the
next booked date and history.

**Acceptance Scenarios**:

1. **Given** a room is currently occupied, **When** the user clicks the room,
**Then** the modal shows the current guest name, check-in/out dates, room
status, and billing party.

2. **Given** a room has had multiple reservations and status changes,
**When** the user opens the room history, **Then** a chronological table shows
all events: reservations, check-ins, check-outs, cleanings, and maintenance.

3. **Given** a room is clean and available, **When** the user clicks it,
**Then** the modal shows room is available, the next future booking (if any),
and the most recent cleaning/history events.

### Edge Cases

- What happens when a reservation is cancelled after the guest has already
  checked in?
- How does the system handle a no-show reservation (guest never arrived)?
- What happens when a staff tries to assign a room under maintenance?
- How does the system handle a split-stay (different rooms during same trip)?
- What happens when a payment exceeds the total amount (overpayment)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Front desk staff MUST be able to search room availability by
  date range, room type, and occupancy count.
- **FR-002**: Availability results MUST show whether each room is available
  for the full stay, partially available, booked, occupied, dirty, under
  maintenance, or blocked.
- **FR-003**: Staff MUST be able to create individual reservations with guest
  name, contact details, dates, room assignment, and billing preference.
- **FR-004**: Staff MUST be able to create company reservations where the
  company is the payer and individual guests can be assigned to specific
  rooms.
- **FR-005**: Staff MUST be able to create group reservations without
  immediately assigning all guest names.
- **FR-006**: Staff MUST be able to create a temporary hold on one or more
  rooms with a configurable expiry time.
- **FR-007**: The system MUST prevent double booking of the same room for
  overlapping dates at the database or service level.
- **FR-008**: Reserved room pricing MUST be explainable by source: default
  rate, room-specific rate, company override, seasonal rate, or manual
  override.
- **FR-009**: Manual price overrides MUST require explicit permission, record
  the old and new price, the reason, and the user who made the change.
- **FR-010**: Staff MUST be able to check a guest in only if the reservation
  is in confirmed status.
- **FR-011**: Staff MUST be able to check a guest out only if the guest is
  currently checked in.
- **FR-012**: Check-out MUST mark the room as dirty for housekeeping.
- **FR-013**: Cancelling a reservation MUST release all assigned rooms for
  future availability.
- **FR-014**: The system MUST support recording payments: deposit, partial
  payment, full payment, and company invoice.
- **FR-015**: Staff MUST be able to view a room's details including current
  status, current reservation, next future reservation, and full event
  history.
- **FR-016**: All sensitive reservation actions (create, confirm, cancel,
  check-in, check-out, price override, payment) MUST be recorded in an audit
  log.
- **FR-017**: Reservation status MUST follow a strict lifecycle and only
  allow valid transitions (draft, held, confirmed, checked in, checked out,
  cancelled, no-show).
- **FR-018**: Room physical status (clean, dirty, maintenance, etc.) MUST be
  tracked separately from reservation status.

### Key Entities

- **Reservation**: The parent booking record containing guest details, dates,
  booking type, billing party, and financial totals.
- **ReservationRoom**: One or more room assignments or stay segments within a
  reservation, each with its own dates, rate, and assignment status.
- **ReservationGuest**: Individual guests linked to a reservation, optionally
  assigned to a specific room, with role (primary, additional).
- **ReservationCompanyInfo**: Company billing configuration, payment terms,
  credit approval, and rate plan applied to a company reservation.
- **ReservationPricingItem**: Explainable price lines with source tracking,
  base rate, discounts, taxes, and override history.
- **ReservationPayment**: Deposits, partial payments, full payments, refunds,
  and company invoices recorded against a reservation.
- **ReservationHold**: Temporary room lock with expiry that blocks
  availability while active.
- **ReservationStatusHistory**: Lifecycle tracking of every status change
  with timestamps and actor identity.
- **ReservationNote**: Operational notes (internal or guest-facing) attached
  to a reservation.
- **RoomStatusHistory**: Optional chronological log of room status changes
  (check-in, check-out, cleaning, maintenance, blocking).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A front desk staff can create a confirmed individual
  reservation, check in the guest, and check them out in under 5 minutes.
- **SC-002**: A company reservation with 3 different rooms assigned to
  different guests can be created and confirmed in under 8 minutes.
- **SC-003**: Two front desk staff attempting to book the same room for
  overlapping dates see one succeed and one receive a clear conflict error
  message.
- **SC-004**: A room hold with a configurable expiry blocks availability while
  active and automatically releases after expiry without manual intervention.
- **SC-005**: Manual price overrides are auditable: the old price, new price,
  reason, and actor identity are retrievable for every override event.
- **SC-006**: Clicking any room from the availability view displays complete
  current status information, active reservation details, and chronological
  room history within 2 seconds.
- **SC-007**: All reservation lifecycle events (create, confirm, check-in,
  check-out, cancel, no-show, price change, payment) are recorded in the
  audit log and traceable to the acting user.

## Assumptions

- Existing modules for bookings, rooms, room types, guests, contacts,
  companies, pricing, permissions/RBAC, accounting/payments, and audit logs
  will be reused and extended rather than duplicated. The existing
  `bookings` table will be extended to serve as the reservation parent;
  new sub-tables (`reservation_rooms`, `reservation_guests`, etc.) will
  be created for new relationships.
- The system uses API-only writes (Next.js route handlers → Supabase service
  role client) rather than direct Supabase client writes for security and
  auditability.
- Room physical status (available, occupied, dirty, clean, maintenance,
  out-of-order, blocked) already exists or will be added alongside the
  reservation model.
- Hold expiry is configurable per hotel policy, with a default of 30 minutes.
- Manual price override requires existing reservation:override_price
  permission.
- The reservation number format is auto-generated and unique.
- Bilingual support (English/Arabic) follows existing i18n patterns.
- The system targets hotel front desk staff as primary users, not guests
  directly (no self-service booking portal in scope).
- Dedicated housekeeping workflow (cleaning schedules, assignments) is
  out of scope; checkout marks room dirty, staff manually updates
  room status when cleaned.
- Expected scale: medium (30-100 rooms, 50-200 reservations/day, 10-30
  concurrent front desk users at peak).
- Error and feedback UX: toast notifications for success and transient
  errors; inline field validation for form issues; no blocking modal
  dialogs for routine operations.
- Reservation number format: sequential prefixed (e.g., RSV-1001,
  RSV-1002) for human-readability and sortability.
