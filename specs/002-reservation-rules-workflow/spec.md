# Feature Specification: Reservation Rules and MCP Workflow

**Feature Branch**: `002-reservation-rules-workflow`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Read docs/plans/reservation_model_supabase_mcp_plan.md and create a specification for: 1. Non-Negotiable Rules, 2. Supabase MCP Workflow (2.1 inspection checklist, 2.2 questions to answer, 2.3 output expected), 3. Target Domain Model (3.1 lifecycle statuses, 3.2 booking types, 3.3 billing parties, 3.4 room assignment statuses, 3.5 physical room statuses)."

## Clarifications

### Session 2026-06-28

- Q: Should the reservation model extend the existing `bookings` table or create a new `reservations` table? → A: Extend `bookings` — add columns to the existing table, treat it as the reservation parent. This avoids duplicating existing foreign key relationships (invoices, payments, contacts) and matches the existing partial implementation in `src/modules/reservations/`.
- Q: What should a developer do if Supabase MCP tools are unavailable during database inspection? → A: Use a graceful fallback — Supabase CLI (`supabase db dump`, `supabase db diff`) or direct SQL queries on `information_schema` to gain equivalent schema visibility. Do not skip inspection entirely.
- Q: What is the billing policy for no-show reservations? → A: First-night charge — the guest pays for the first night only. This is the hotel industry standard: compensates for holding the room while forgiving remaining nights.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Applies Non-Negotiable Rules (Priority: P1)

A developer implementing the reservation data model must understand and follow a set of hard constraints that govern how reservations, rooms, pricing, and audits are built. These rules ensure the system remains safe, auditable, and consistent regardless of the developer implementing them.

**Why this priority**: The non-negotiable rules define the system's safety invariants. Violating them could allow double booking, un-audited price changes, or schema drift — defects that are expensive to fix after data is live.

**Independent Test**: For each rule, a reviewer can inspect the implementation and verify that the rule is enforced at the correct architectural layer (database, service, or API).

**Acceptance Scenarios**:

1. **Given** a developer is about to create a migration, **When** they inspect the existing schema first (per rule 2), **Then** they have a complete picture of existing tables, columns, enums, and relationships before making changes.

2. **Given** a reservation is being confirmed, **When** two users attempt to book the same room for overlapping dates, **Then** the database or service layer (not the frontend) prevents the double booking.

3. **Given** a manual price override is applied, **When** the system processes it, **Then** the old price, new price, reason, and actor identity are recorded in the audit log and the override required explicit permission.

4. **Given** a booking is cancelled, **When** the cancellation completes, **Then** the room is released for future availability and the reservation status is updated independently from the room's physical status.

---

### User Story 2 - Database Inspection via Supabase MCP (Priority: P2)

A developer preparing to implement reservation features needs to inspect the existing database schema through the Supabase MCP tools. The inspection covers tables, columns, enums, foreign keys, indexes, RLS policies, stored procedures, and existing migrations to determine what can be reused vs. what must be created.

**Why this priority**: Skipping database inspection leads to the most common implementation error — duplicating existing tables or misaligning foreign keys with the existing schema. This waste costs significant rework.

**Independent Test**: After running through the inspection checklist, the developer can produce a findings document listing which tables exist, which must be extended, and which must be created.

**Acceptance Scenarios**:

1. **Given** a developer is starting reservation implementation, **When** they run the MCP inspection checklist, **Then** they know the exact state of: bookings, rooms, room_types, guests, contacts, pricing, payments, profiles, roles/permissions, and audit_logs tables.

2. **Given** the inspection is complete, **When** the developer answers the MCP questions, **Then** they can decide whether to extend the existing `bookings` table or create a new `reservations` table, and they know which new tables are needed.

3. **Given** the inspection output is produced, **When** the developer writes the implementation note, **Then** it contains the list of tables to extend, tables to create, and migrations needed.

---

### User Story 3 - Target Domain Model Implementation (Priority: P2)

A developer needs to implement the reservation domain model with correct lifecycle statuses, booking types, billing parties, and room status tracking. The model must keep reservation status separate from room physical status.

**Why this priority**: The domain model is the core of the reservation system. Ambiguous or incorrect status definitions lead to inconsistent availability calculations, billing errors, and reporting inaccuracies.

**Independent Test**: A developer can create a reservation in each supported booking type, move it through the correct lifecycle, assign the correct billing party, and verify that room assignment status and physical room status are tracked independently.

**Acceptance Scenarios**:

1. **Given** a reservation is created, **When** its status changes, **Then** it follows the allowed transitions: draft → held → confirmed → checked_in → checked_out, with alternative flows for cancellation, no-show, and expiry.

2. **Given** a reservation is created for a company, **When** the booking type is set to `company`, **Then** the billing party is `company` and the company is the payer while individual guests are the sleepers.

3. **Given** a room is assigned, **When** the reservation progresses, **Then** the room assignment status transitions independently (selected → held → reserved → occupied → checked_out) from the room's physical status (available, dirty, clean, maintenance, etc.).

### Edge Cases

- What happens when a reservation is cancelled mid-stay after check-in? The room must be released, but consumed nights must still be billed.
- How does the system handle a hold that expires while a user is filling in guest details? The hold must be revalidated before confirmation.
- Can a company be both the billing party and the sleeping guest? Yes — `company` billing party with company employees as room guests.
- What happens when a `complimentary` booking needs price tracking? Pricing can be recorded at zero but must still track the original rate for reporting.
- How does the system handle a `draft` reservation that is never finished? Drafts with no activity may need periodic cleanup.
- How does billing work for a no-show reservation? The guest is charged for the first night only — this follows the hotel industry standard. The remaining nights are released.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST use Supabase/Postgres as the authoritative source of truth for all reservation data.
- **FR-002**: Every schema change MUST be applied through numbered Supabase migrations.
- **FR-003**: The system MUST NOT duplicate existing tables unless the existing model cannot support the requirement. The existing `bookings` table MUST be extended as the reservation parent rather than creating a new `reservations` table.
- **FR-004**: Double booking MUST be prevented at the database or service layer — not the frontend alone.
- **FR-005**: Reservation lifecycle status MUST be tracked separately from room physical/operational status.
- **FR-006**: All sensitive reservation actions (create, confirm, cancel, check-in, check-out, price override, payment) MUST write an audit log entry.
- **FR-007**: All write operations MUST verify the user session and action permission before executing.
- **FR-008**: Company bookings MUST support the company as the payer and individual guests as sleepers in assigned rooms.
- **FR-009**: Manual price override MUST require explicit permission, record old and new price, reason, and actor identity.
- **FR-010**: Room holds MUST expire after a configurable duration and MUST stop blocking availability after expiry.
- **FR-011**: Availability MUST be calculated from reservations, room status, active holds, and maintenance/block data.
- **FR-012**: Before writing any migration, the developer MUST inspect the existing database schema using Supabase MCP tools. If MCP tools are unavailable, fall back to Supabase CLI (`supabase db dump`, `supabase db diff`) or direct SQL queries on `information_schema` to gain equivalent visibility — never skip inspection entirely.
- **FR-013**: The inspection MUST cover: existing tables, columns, enums, foreign keys, indexes, RLS policies, database functions, and existing migrations.
- **FR-014**: After inspection, a findings document MUST be produced listing tables to extend, tables to create, and migrations needed.
- **FR-015**: Reservation status MUST only transition according to the strict lifecycle: draft ↔ held → confirmed → checked_in → checked_out, with allowed alternative flows for cancelled, no-show, and expired.
- **FR-016**: Reservation booking types MUST include: individual, company, group, travel_agent, internal.
- **FR-017**: Billing parties MUST include: guest, company, split, complimentary.
- **FR-018**: Room assignment statuses MUST track the reservation-to-room relationship independently: selected, held, reserved, occupied, checked_out, cancelled, released.
- **FR-019**: Room physical statuses MUST track the operational state independently: available, occupied, dirty, clean, inspected, maintenance, out_of_order, blocked, reserved_future, due_out, due_in.

### Key Entities *(include if feature involves data)*

- **Reservation**: Parent booking record with lifecycle status, booking type, billing party, dates, guest/company details, and financial totals.
- **ReservationRoom**: Room assignment within a reservation — supports multi-room bookings, room moves, split-stays, and per-room pricing/status.
- **ReservationGuest**: Guest attached to a reservation with role (primary/additional), optionally assigned to a specific room.
- **ReservationCompanyInfo**: Company billing configuration, credit terms, rate plan, and payment rules applied to a company reservation.
- **ReservationPricingItem**: Per-line pricing entry with source tracking (default rate, room rate, company override, seasonal, manual), base/applied rate, discounts, and taxes.
- **ReservationPayment**: Payment record tied to a reservation: deposit, partial, full, refund, company invoice, guarantee.
- **ReservationHold**: Temporary room lock that blocks availability while active, auto-expires after configurable duration.
- **ReservationNote**: Operational note (internal or guest-facing) attached to a reservation.
- **ReservationStatusHistory**: Lifecycle audit trail recording every status change with actor and timestamp.
- **RoomStatusHistory**: Chronological log of physical room status changes (check-in, check-out, cleaning, maintenance, blocking).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new developer can read the non-negotiable rules and correctly implement a reservation confirmation flow without double booking, missing permissions, or missing audit logs.
- **SC-002**: A developer following the MCP inspection workflow produces a complete findings document in under 30 minutes.
- **SC-003**: Every reservation status transition is validated against the strict lifecycle — no invalid transitions are possible regardless of input source.
- **SC-004**: Room physical status and reservation lifecycle status are independently queryable and never conflated in the data model.
- **SC-005**: All 14 non-negotiable rules are verifiable by code review — each rule maps to a specific enforcement point in the codebase.
- **SC-006**: A company reservation with 5 rooms assigned to different guests can be represented with correct billing party assignment and company rate tracking.

## Assumptions

- The existing project already has modules for bookings, rooms, room types, guests, contacts/companies, pricing, permissions/RBAC, accounting/payments, and audit logs. The implementation should reuse and extend these.
- The system uses API-only writes (Next.js route handlers → Supabase service role client) rather than direct Supabase client writes for security and auditability.
- Bilingual support (English/Arabic) follows existing i18n patterns — reservation-specific keys will be added.
- Hold expiry is configurable per hotel policy with a default duration.
- The reservation number format follows a sequential prefixed format (e.g., RSV-1001) for human readability.
- The system targets hotel front desk staff as primary users — no self-service guest portal.
- Dedicated housekeeping workflow (scheduling, assignments) is out of scope; check-out marks room dirty and staff manually clears status.
- Expected scale: medium (30-100 rooms, 50-200 reservations/day, 10-30 concurrent front desk users).
- The implementation follows the project constitution (Database-First, Strict Layered Architecture, TypeScript Strictness, Security/RBAC/Audit, Code Quality).
