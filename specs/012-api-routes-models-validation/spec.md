# Feature Specification: API Routes, TypeScript Models, and Validation

**Feature Branch**: `012-api-routes-models-validation`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Phase 11 — API / Route Handlers - Phase 12 — TypeScript Models and Validations - Phase 13 — Validation Rules from d:\ai-practise\hotel-system\docs\plans\reservation_model_supabase_mcp_plan.md"

## Clarifications

### Session 2026-06-28

- Q: How should validation errors be returned by the API? → A: Structured error array following Zod shape — `{ errors: [{ path, message, code }] }`
- Q: What operations are explicitly out of scope for these API endpoints? → A: Bulk operations, CSV export, and webhook endpoints are excluded; scope stays within the 17+ lifecycle and read endpoints listed.
- Q: Should lifecycle mutation endpoints (confirm, cancel, check-in, check-out) be idempotent? → A: Yes — idempotent; repeat calls check current state and return success without side effects if already applied.
- Q: What rate limiting should apply to API endpoints? → A: Soft limit of 60 req/min per user with standard 429 response including Retry-After header.
- Q: How should the list reservations endpoint handle pagination and filtering? → A: Cursor-based pagination (`?cursor=abc&limit=20`) with filters: status, date range, guest name, booking type, company.

## User Scenarios & Testing

### User Story 1 — Reservation API Endpoints (Priority: P1)

A front desk user can perform all reservation operations — create, view, update, hold, confirm, check in, check out, cancel, and mark no-show — through safe backend API endpoints. Every write operation verifies the user's identity, checks their permissions, validates the input data, prevents conflicts, and records an audit trail.

**Why this priority**: Without secure API endpoints, no reservation operations can be performed through the system. This is the foundational user-facing layer.

**Independent Test**: Can be fully tested by calling each reservation lifecycle endpoint with valid and invalid inputs and confirming correct behavior, error messages, and audit log entries.

**Acceptance Scenarios**:

1. **Given** an authenticated front desk user with create permission, **When** they submit a valid reservation creation request, **Then** a new draft reservation is created and its ID is returned.
2. **Given** an authenticated user with confirm permission and a valid draft reservation with held rooms, **When** they submit a confirm request, **Then** the reservation status changes to confirmed and audit log is written.
3. **Given** an authenticated user without cancel permission, **When** they attempt to cancel a reservation, **Then** the request is rejected with a permission denied response.
4. **Given** an unauthenticated request, **When** any write endpoint is called, **Then** a 401 unauthorized response is returned.

---

### User Story 2 — Room and Guest Operations through API (Priority: P2)

A front desk user can manage room assignments (change room, release room), manage reservation guests (add, update), record payments, and retrieve room details with history through dedicated API endpoints.

**Why this priority**: These operations extend the core lifecycle to cover real-world front desk scenarios that arise during a guest's stay.

**Independent Test**: Can be fully tested by calling room change, guest management, payment recording, and room history endpoints and confirming correct data updates and audit trail.

**Acceptance Scenarios**:

1. **Given** a checked-in reservation, **When** the user submits a room change request with a valid alternative room, **Then** the old room is released and the new room is assigned in a single logical operation.
2. **Given** an existing reservation, **When** the user adds a new guest with valid details, **Then** the guest is added and linked to the reservation.
3. **Given** a reservation with an outstanding balance, **When** the user records a payment, **Then** the paid amount and balance are updated, and an audit entry is created.

---

### User Story 3 — Input Validation and Error Prevention (Priority: P3)

The system consistently validates all reservation input data — dates, guest counts, room assignments, pricing, and payments — before any operation is executed. Invalid data is rejected with clear, user-friendly error messages.

**Why this priority**: Validation prevents data corruption and reduces the need for manual corrections. It is a quality layer on top of the functional endpoints.

**Independent Test**: Can be fully tested by submitting invalid data to each endpoint and confirming that meaningful validation errors are returned and no data changes are made.

**Acceptance Scenarios**:

1. **Given** a reservation creation request with check-out date before check-in date, **When** submitted, **Then** the request is rejected with a validation error.
2. **Given** a reservation with zero adults and zero children, **When** submitted, **Then** the request is rejected because at least one occupant is required.
3. **Given** a room assignment for a room that is out of order, **When** submitted without manager override, **Then** the request is rejected with an appropriate error.

### Out of Scope

The following are explicitly excluded from this phase:
- Bulk reservation creation, update, or cancellation endpoints
- CSV or spreadsheet import/export of reservation data
- Webhook integration for external system notification
- Real-time reservation status push via WebSocket or SSE
- Public-facing booking API (all endpoints are for internal front desk use only)

### Edge Cases

- What happens when a room change request targets a room that has become unavailable between the search and the change?
- How does the system handle concurrent requests to confirm the same reservation or change the same room?
- What if a payment recording request arrives after the reservation is already fully paid?
- What if a guest addition request includes a guest ID that does not exist in the system?
- How does the system handle partial updates where only some fields are provided?
- What error format is returned when multiple validation failures occur in a single request? — All validation errors are returned as a structured array `{ errors: [...] }`; the client receives every violation, not just the first one.
- What happens if the user submits the same lifecycle action (confirm, cancel, check-in) twice? — The endpoint is idempotent; if the reservation is already in the target status, the second call returns success without re-executing side effects.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a GET endpoint to list reservations with cursor-based pagination (`?cursor=abc&limit=20`) and filters for status, date range, guest name, booking type, and company.
- **FR-002**: System MUST provide a GET endpoint to retrieve a single reservation by ID with full details.
- **FR-003**: System MUST provide a POST endpoint to create a new draft reservation.
- **FR-004**: System MUST provide a PATCH endpoint to update an existing draft reservation.
- **FR-005**: System MUST provide a POST endpoint to hold rooms for a reservation.
- **FR-006**: System MUST provide a POST endpoint to release a hold on reservation rooms.
- **FR-007**: System MUST provide a POST endpoint to confirm a reservation.
- **FR-008**: System MUST provide a POST endpoint to check in a confirmed reservation.
- **FR-009**: System MUST provide a POST endpoint to check out a checked-in reservation.
- **FR-010**: System MUST provide a POST endpoint to cancel a reservation.
- **FR-011**: System MUST provide a POST endpoint to mark a reservation as no-show.
- **FR-012**: System MUST provide a GET endpoint for room availability search.
- **FR-013**: System MUST provide endpoints to add, update, and remove rooms from a reservation.
- **FR-014**: System MUST provide endpoints to add and update guests on a reservation.
- **FR-015**: System MUST provide a POST endpoint to record a payment on a reservation.
- **FR-016**: System MUST provide a GET endpoint for room details with history.
- **FR-017**: System MUST provide a GET endpoint for room history only.
- **FR-018**: Every write endpoint MUST verify the user session before executing the operation.
- **FR-019**: Every write endpoint MUST check the caller's action permission before executing.
- **FR-020**: Every write endpoint MUST validate input data using typed schemas.
- **FR-021**: Reservation write endpoints MUST perform server-side conflict checks (e.g., double booking prevention).
- **FR-022**: Critical reservation writes MUST use database transactions or RPCs for atomicity.
- **FR-023**: Every write endpoint MUST create an audit log entry recording the action, actor, and affected resource.
- **FR-024**: All endpoints MUST return safe, sanitized error messages (no stack traces or internal details). Validation errors MUST use a structured format: `{ errors: [{ path: string, message: string, code: string }] }`.
- **FR-025**: CreateReservationInput MUST validate: checkInDate required, checkOutDate required, checkOutDate after checkInDate, nights > 0, bookingType required, roomCount > 0, adults + children > 0, billingParty required.
- **FR-026**: ConfirmReservationInput MUST validate: selectedRooms non-empty, each room has roomId and roomTypeId, pricingAccepted true, payment method valid.
- **FR-027**: Room assignment validation MUST check: room exists, room is active, room is not out_of_order, room capacity sufficient, no date overlap with active reservations.
- **FR-028**: Payment recording MUST validate: amount > 0, payment type is valid, paid amount does not exceed total unless overpayment is explicitly allowed.
- **FR-029**: System MUST validate company booking rules when bookingType is company: company ID required, billing method required, credit approval required for company credit.
- **FR-030**: Manual price override endpoints MUST validate: override reason provided, caller has override permission, audit log includes old price, new price, reason, and actor.
- **FR-031**: Lifecycle mutation endpoints (confirm, cancel, check-in, check-out, no-show) MUST be idempotent — calling them multiple times with the same input MUST return success without duplicating side effects.
- **FR-032**: All API endpoints MUST enforce a rate limit of 60 requests per minute per authenticated user, returning HTTP 429 with a Retry-After header when exceeded.

### Key Entities

- **Reservation API Endpoint**: A secure HTTP endpoint accepting and returning JSON, protected by session verification and permission checks, with input validation and audit logging.
- **Input Model / Zod Schema**: A typed blueprint that defines the structure, types, and constraints for every API request payload, used to validate data at the boundary.
- **Validation Rule**: A business logic constraint that data must satisfy before an operation can proceed, producing a clear error message when violated.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 15+ reservation lifecycle and room operation endpoints can be called successfully with valid inputs and appropriate permissions.
- **SC-002**: Every write endpoint returns an appropriate 4xx error when called without authentication, without permission, or with invalid data.
- **SC-003**: A user can complete the full reservation lifecycle (create draft → hold → confirm → check-in → check-out) through API calls alone in under 30 seconds.
- **SC-004**: Every successful write operation produces exactly one audit log entry recording the action and actor.
- **SC-005**: Concurrent requests to confirm overlapping room assignments are prevented — only one succeeds and the others receive conflict errors.
- **SC-006**: 100% of defined validation rules are enforced — no invalid data can pass through the API layer.

## Assumptions

- Existing secure endpoint patterns (session verification, permission checking, error handling) from the current codebase will be reused.
- The `actionPermissions.ts` configuration will be extended to cover all new reservation lifecycle permissions.
- The existing Zod validation approach in the project will be the standard for all input schemas.
- API endpoints will follow Next.js App Router route handler conventions.
- Error responses will follow a consistent JSON format across all endpoints.
- Room availability search endpoint already exists or will be built separately as part of the availability service phase.
- The system already has database tables for reservations, reservation_rooms, reservation_guests, reservation_holds, reservation_payments, reservation_status_history, and audit_logs from prior phases.
- Arabic RTL and English LTR locale support will apply to API error messages based on existing i18n patterns.
