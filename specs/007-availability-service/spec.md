# Feature Specification: Availability RPC / Service

**Feature Branch**: `007-availability-service`

**Created**: 2026-06-28

**Status**: Clarified

**Input**: User description: "Phase 5 — Availability RPC / Service from docs/plans/reservation_model_supabase_mcp_plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Room Availability Lookup for Front Desk (Priority: P1)

The front desk user can enter check-in and check-out dates and see which rooms are available for the full stay, which have partial conflicts, and which are completely booked. The system shows room number, type, floor, capacity, and a per-night price preview — all in a single query.

**Why this priority**: This is the primary query used in every booking conversation at the front desk. Without a fast and accurate availability result, staff cannot inform guests about room options or proceed with reservations.

**Independent Test**: A front desk user calls `get_room_availability('2026-07-01', '2026-07-03')` and receives a list of rooms with correct availability_status per room — rooms with overlapping reservations show as 'booked', rooms without conflicts show as 'available_for_full_stay', and rooms with partial overlap show the appropriate status.

**Acceptance Scenarios**:

1. **Given** rooms with no overlapping reservations or holds for the requested dates, **When** the user queries availability, **Then** those rooms return `availability_status = 'available_for_full_stay'` with `canSelect = true`.
2. **Given** a room with an overlapping confirmed reservation covering the full requested range, **When** the user queries, **Then** the room returns `availability_status = 'booked'` with `canSelect = false`.
3. **Given** a room with a reservation that overlaps only part of the requested range, **When** the user queries, **Then** the room returns `availability_status = 'partially_available'` or `'available_after_checkout'` with appropriate `availableFrom`/`availableUntil` dates.
4. **Given** a room that is currently occupied (guest checked in), **When** the user queries, **Then** it returns `availability_status = 'occupied_now'` with `canSelect = false`.
5. **Given** a room whose guest is due to check out today, **When** the user queries for a stay starting today, **Then** it returns `availability_status = 'due_out_today'` with `canSelect = true` (available after housekeeping).

---

### User Story 2 - Availability Filtering and Price Preview (Priority: P2)

The front desk user can filter availability by room type, minimum capacity, and company pricing. The result includes a per-room price preview showing the nightly rate and total, with company-specific overrides applied when a company context is provided.

**Why this priority**: After seeing the basic availability list, the front desk needs to narrow options by guest requirements (room type, capacity) and see pricing. Company overrides are critical for corporate bookings to ensure accurate quotes.

**Independent Test**: Calling `get_room_availability` with `p_room_type_id = 'suite-uuid'` returns only rooms of that type. Calling with `p_company_id = 'acme-uuid'` returns pricing that reflects Acme Corp's negotiated rates.

**Acceptance Scenarios**:

1. **Given** a room type filter, **When** the user queries availability, **Then** only rooms matching the requested type are returned.
2. **Given** an adult/child count filter, **When** the user queries, **Then** only rooms with capacity >= requested total guests are returned.
3. **Given** a company ID parameter, **When** the user queries, **Then** the `pricePreview` reflects company-specific rates from the `company_price_overrides` table.
4. **Given** no company ID, **When** the user queries, **Then** the `pricePreview` uses the default room type rate.
5. **Given** a dirty room, **When** the user queries without `p_include_dirty = true`, **Then** the room returns `availability_status = 'available_after_cleaning'` with `canSelect = false`.

---

### User Story 3 - Availability Conflict Detail (Priority: P3)

The front desk user can see detailed conflict information for rooms that are not fully available. Each conflict shows which reservation is causing the conflict, the guest name, date range, and conflict type. This helps the staff explain to guests why a room is unavailable and suggest alternatives.

**Why this priority**: When a guest's preferred room is unavailable, the front desk needs to explain why and offer nearby alternatives or adjust dates. Conflict details enable informed guest conversations.

**Independent Test**: For a room with 'booked' status, the result includes a conflict entry with the existing reservation number, guest name, check-in/out dates, and conflict type = 'date_overlap'.

**Acceptance Scenarios**:

1. **Given** a room with a date overlap conflict, **When** the user queries, **Then** the conflict entry includes `reservationNumber`, `guestName`, `checkInDate`, `checkOutDate`, and `conflictType = 'date_overlap'`.
2. **Given** a room that is blocked (out of order), **When** the user queries, **Then** it returns `availability_status = 'blocked'` with conflict type `'blocked'` and `canSelect = false`.
3. **Given** a room in maintenance, **When** the user does not pass `p_include_maintenance = true`, **Then** it returns `availability_status = 'maintenance'` with `canSelect = false`.
4. **Given** a room with an active hold, **When** the user queries, **Then** it shows as booked with conflict type `'active_hold'`.

---

### Edge Cases

- What happens when check_in_date >= check_out_date? The RPC should return an empty result set or raise a clear error.
- What happens when the date range spans more than 365 days? The query should limit to a reasonable maximum stay (e.g., 90 days) to prevent performance degradation.
- What happens when a reservation straddles the requested range (check_in before, check_out after)? The room should show as 'booked' for the full stay.
- What happens when there are no rooms matching the filters? The result set should be empty, not an error.
- What happens when company pricing is requested but the company has no price override? Should fall back to default room type rate — not error.
- What happens when a room is reserved in the future but currently available? Should return `availability_status = 'reserved_in_future'` with the future conflict dates.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept check_in_date, check_out_date, and optional filters (room_type_id, company_id, adults, children, include_dirty, include_maintenance) to query room availability.
- **FR-002**: System MUST return availability_status per room with one of: available_for_full_stay, booked, occupied_now, reserved_in_future, due_out_today, available_after_checkout, available_after_cleaning, partially_available, not_available, blocked, maintenance.
- **FR-003**: System MUST return current_room_status per room from the room_physical_status enum values.
- **FR-004**: System MUST return pricePreview with ratePerNight, totalAmount, currency, and priceSource for each room — applying company overrides when company_id is provided.
- **FR-005**: System MUST return canSelect boolean with selectDisabledReason string for rooms that cannot be selected.
- **FR-006**: System MUST return availableFrom and availableUntil dates for rooms with partial availability or future conflicts.
- **FR-007**: System MUST return conflicts array per room with reservationId, reservationNumber, guestName, companyName, checkInDate, checkOutDate, conflictType, and human-readable message.
- **FR-008**: System MUST apply the availability overlap rule: existing.check_in_date < requested.check_out_date AND existing.check_out_date > requested.check_in_date AND existing.status IN ('held', 'reserved', 'occupied').
- **FR-009**: System MUST filter by room type when p_room_type_id is provided.
- **FR-010**: System MUST filter by capacity when p_adults and/or p_children are provided.
- **FR-011**: System MUST exclude dirty rooms from 'available' results unless p_include_dirty is true.
- **FR-012**: System MUST exclude maintenance and out_of_order rooms unless p_include_maintenance is true.
- **FR-013**: System MUST return an empty result set (not an error) when no rooms match the criteria.

### Key Entities *(include if feature involves data)*

- **Rooms** — Physical room definitions (number, type, floor, capacity, physical status). Source of `current_room_status`.
- **Room Types** — Room category definitions. Used for type filtering and default pricing.
- **Reservations** — Parent reservation records. Date ranges drive overlap detection.
- **Reservation Rooms** — Room assignments with dates and status. Core of the overlap check.
- **Reservation Holds** — Active holds on rooms (with expiry). Causes `active_hold` conflict type.
- **Reservation Pricing Items** — Per-room pricing lines. Source for price preview overrides.
- **Company Price Overrides** — Company-specific room type rates. Applied when company_id provided.
- **Guests** — Used for conflict guest name resolution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Front desk staff can query availability for a 3-night stay and see results for all rooms in under 2 seconds on a database with 10,000+ reservations.
- **SC-002**: All 11 availability statuses are correctly assigned per room — verified by query results matching expected status for known reservation patterns.
- **SC-003**: Company-specific pricing appears in pricePreview when company_id is provided — verified by comparing with company_price_overrides table.
- **SC-004**: Conflict details are returned for every non-available room — verified that 'booked' rooms have at least one conflict entry.
- **SC-005**: Date range validation rejects invalid ranges (check_in >= check_out) with a clear error message.
- **SC-006**: Maximum stay of 90 days is enforced — queries beyond 90 days return a user-friendly error.

## Assumptions

- The existing `get_room_availability` RPC function already exists in the database — this phase enhances it, not creates from scratch.
- All 9 reservation tables from Phase 2 are already deployed with test data.
- Room pricing is determined by: (a) company_price_overrides if company_id provided and override exists, (b) room_types.default_rate otherwise.
- The overlap rule uses `reservation_room.status IN ('held', 'reserved', 'occupied')` — draft and cancelled rooms are excluded.
- Active holds are those with `status = 'active'` and `expires_at > now()`.
- The front desk system is the primary consumer — this is an internal admin tool, not a public-facing booking engine.
- The RPC is called with `security definer` to read all tables regardless of RLS, and permission is enforced by the `can_read_reservations()` guard (added in Phase 4).
- Performance at 100K+ reservations requires the indexes from Phase 3 on `reservation_rooms(check_in_date, check_out_date)` and `reservation_rooms(room_id, check_in_date, check_out_date)`.
- This phase is backend-only (RPC SQL enhancement). No frontend UI components are included.
- Pricing is simple: default room type rate + optional company price override. No seasonal/dynamic pricing.
- Observability (slow-query logging, performance counters) is out of scope for this phase.

## Out of Scope

- Frontend UI components (availability grid, calendar picker, hooks, or Zustand/RTK slices) — deferred to a separate UI phase.
- Seasonal or dynamic pricing tables and logic.
- Observability instrumentation (slow-query logging, metrics counters, tracing).
- Rate limiting or abuse prevention for the RPC.

## Clarifications

- **Q1 (Frontend scope)**: This phase is backend-only. No availability grid, calendar picker, hooks, or Zustand/RTK slices are included.
- **Q2 (Pricing complexity)**: Simple pricing model — room type default rate + company price override only. No seasonal rates or dynamic pricing.
- **Q3 (Observability)**: Skip slow-query logging and performance counters in this phase. Observability is a cross-cutting concern deferred to operations.
