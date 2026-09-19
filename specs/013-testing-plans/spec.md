# Feature Specification: Testing Plans for Reservation Model

**Feature Branch**: `013-testing-plans`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Phase 14 — Testing Plans from d:\ai-practise\hotel-system\docs\plans\reservation_model_supabase_mcp_plan.md"

## Clarifications

### Session 2026-06-28

- Q: What test types are explicitly excluded from this testing plan? → A: Performance/load testing and security penetration testing are excluded. Focus is on functional correctness only (unit, integration, E2E).
- Q: How should test data be created for integration and E2E tests? → A: Factory functions that create test data via service-layer method calls, composable per scenario.

## User Scenarios & Testing

### User Story 1 — Core Logic Unit Tests (Priority: P1)

A developer can run unit tests that verify the reservation model's core business logic — date overlap detection, status transition validation, pricing priority resolution, payment balance calculation, and permission checks — in isolation without database dependencies. These tests provide fast feedback during development and catch regressions instantly.

**Why this priority**: Unit tests are the fastest feedback loop. They validate core business rules without external dependencies, making them the first line of defense against bugs.

**Independent Test**: Run the full unit test suite — all tests pass in under 10 seconds with no database or server required.

**Acceptance Scenarios**:

1. **Given** two date ranges with overlapping dates, **When** overlap detection is called, **Then** it correctly identifies the overlap.
2. **Given** a status transition from "confirmed" to "checked_in", **When** validated, **Then** the transition is accepted.
3. **Given** a status transition from "checked_out" to "confirmed", **When** validated, **Then** the transition is rejected as invalid.
4. **Given** multiple pricing sources (manual, company, seasonal, room-type), **When** price priority is resolved, **Then** the highest-priority source is selected.
5. **Given** a reservation with a total amount and a payment, **When** balance is calculated, **Then** the balance equals total minus paid.

---

### User Story 2 — Integration Tests for Reservation Flows (Priority: P2)

A developer can run integration tests that verify complete reservation flows — creating individual and company reservations, holding and confirming rooms, preventing double bookings, canceling reservations, checking in and out, and verifying audit log entries — against a test database.

**Why this priority**: Integration tests validate that the services, database, and permissions work together correctly, catching issues that unit tests cannot.

**Independent Test**: Run the integration test suite — all tests pass against a test database with seeded rooms, room types, and guest records.

**Acceptance Scenarios**:

1. **Given** valid input data, **When** an individual reservation is created, **Then** a draft reservation is persisted with correct data.
2. **Given** a draft reservation with held rooms, **When** confirmed, **Then** the reservation status changes to confirmed and conflict prevention is verified.
3. **Given** two reservation attempts for the same room on overlapping dates, **When** both attempt to confirm, **Then** one succeeds and the other is prevented (no double booking).
4. **Given** a confirmed reservation, **When** canceled, **Then** the room is released for future booking.
5. **Given** a manual price override, **When** applied, **Then** an audit log entry is created recording the change.

---

### User Story 3 — End-to-End Front Desk Scenarios (Priority: P3)

A tester can run E2E scenarios that simulate real front desk workflows — same-day walk-in booking, future reservations, room status transitions, company multi-room bookings, split-stay reservations, room changes, and stay extension conflicts — through the complete system including API endpoints.

**Why this priority**: E2E tests validate that the full stack works together, simulating how front desk staff will actually use the system.

**Independent Test**: Run the E2E scenario suite — all scenarios pass against a running server with a test database.

**Acceptance Scenarios**:

1. **Given** a walk-in guest, **When** a same-day booking is created through the API, **Then** the reservation is confirmed and the room is marked as occupied for the stay period.
2. **Given** a future reservation for a room, **When** another reservation is attempted for the same room during the same dates, **Then** the conflict is detected and prevented.
3. **Given** a checked-in reservation, **When** a room change is requested, **Then** the old room is released and the new room is assigned with correct audit trail.
4. **Given** a confirmed reservation and an existing future overlapping booking for the same room, **When** the stay is extended, **Then** the extension is rejected with a conflict error.
5. **Given** multiple rooms booked by a company, **When** the reservation is created, **Then** guest names can be pending and the company is the payer.

### Out of Scope

The following test types are explicitly excluded from this plan:
- Performance and load testing (e.g., concurrent user throughput, response time under load)
- Security penetration testing (e.g., SQL injection, XSS, auth bypass attempts)
- Visual regression testing (e.g., UI screenshot diffing)
- Accessibility compliance testing (e.g., WCAG audit)

### Edge Cases

- What happens when a hold expires between creation and confirmation attempts?
- How does the system handle a cancellation request for an already-checked-out reservation?
- What if the database is unavailable during a confirm operation — does the error surface correctly?
- What happens when a room change is attempted to a room that is currently dirty?
- How does the system behave when two users simultaneously release and confirm the same hold?

## Requirements

### Functional Requirements

- **FR-001**: Unit tests MUST cover date overlap detection for reservation date ranges.
- **FR-002**: Unit tests MUST cover status transition validation — all valid and invalid transitions from the status map.
- **FR-003**: Unit tests MUST cover nights calculation from check-in and check-out dates.
- **FR-004**: Unit tests MUST cover pricing priority resolution (manual > company > seasonal > room-type).
- **FR-005**: Unit tests MUST cover company billing validation rules.
- **FR-006**: Unit tests MUST cover payment balance calculation (total - paid = balance).
- **FR-007**: Unit tests MUST cover permission check verification for each reservation action.
- **FR-008**: Integration tests MUST cover creating individual, company, and multi-room reservations.
- **FR-009**: Integration tests MUST cover the hold → confirm flow including hold expiry.
- **FR-010**: Integration tests MUST verify double booking is prevented at the database/service level.
- **FR-011**: Integration tests MUST verify canceling a reservation releases the room.
- **FR-012**: Integration tests MUST verify check-in and check-out status transitions.
- **FR-013**: Integration tests MUST verify manual price override writes an audit log entry.
- **FR-014**: E2E tests MUST cover same-day walk-in booking flow.
- **FR-015**: E2E tests MUST cover future reservation with room already occupied today.
- **FR-016**: E2E tests MUST cover room due-out today and dirty-after-checkout flow.
- **FR-017**: E2E tests MUST verify maintenance rooms cannot be selected for booking.
- **FR-018**: E2E tests MUST cover company multi-room booking with pending guest names.
- **FR-019**: E2E tests MUST cover split-stay reservation across multiple rooms.
- **FR-020**: E2E tests MUST cover room change during an active stay.
- **FR-021**: E2E tests MUST cover stay extension that conflicts with an existing future reservation.

### Key Entities

- **Unit Test**: A fast, isolated test verifying a single business logic function without external dependencies.
- **Integration Test**: A test that verifies service-layer and database interactions against a test database.
- **E2E Scenario**: A full-stack test that simulates a complete front desk workflow through the API endpoints.
- **Test Suite**: A collection of test cases organized by test type (unit, integration, E2E) that can be run together or independently.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All unit tests complete in under 10 seconds.
- **SC-002**: All integration tests complete in under 60 seconds against a test database.
- **SC-003**: All E2E scenarios complete in under 5 minutes against a running server.
- **SC-004**: 100% of defined business rules have at least one unit test covering the rule.
- **SC-005**: Every reservation lifecycle status transition has a corresponding integration test.
- **SC-006**: Every E2E scenario from the front desk workflow list has a passing automated test.
- **SC-007**: No double-booking scenario passes the integration test suite (the system must prevent all overlapping confirmations).

## Assumptions

- Existing test framework (Vitest) will be used for unit and integration tests.
- A test database with seeded rooms, room types, guests, and companies is available for integration tests.
- The server can be started locally for E2E scenario testing.
- Existing service methods and API routes from prior phases are already implemented and available to test.
- Test data will be created via factory functions that call existing service methods, composable per scenario, with cleanup after each test (no shared state between tests).
- Integration tests may use the service-role Supabase client directly to set up test data.
- E2E scenarios will use the API endpoints with authentication tokens.
