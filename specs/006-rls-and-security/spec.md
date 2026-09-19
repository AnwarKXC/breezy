# Feature Specification: RLS and Security

**Feature Branch**: `006-rls-and-security`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Phase 4 — RLS and Security from docs/plans/reservation_model_supabase_mcp_plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Role-Based Access Control for Reservation Operations (Priority: P1)

The front desk user can create, read, update, confirm, check in, check out, and record payments on reservations — but cannot cancel, override pricing, or refund payments (manager-only). Managers and admins can perform all operations including sensitive actions. Accountants can read reservation data and payments but cannot write.

**Why this priority**: The Phase 2 migration (004) deployed coarse RLS with only can_read/can_write/ can_override helpers. Without proper role-permission mapping, a front desk user can delete, override pricing, or potentially access data they should not. This is the minimum viable security boundary.

**Independent Test**: A front desk user logged in with `app_role = 'front_desk'` can create a reservation and record a payment, but receives a permission-denied error when attempting to override pricing or cancel a reservation.

**Acceptance Scenarios**:

1. **Given** a front_desk user authenticated with `app_role = 'front_desk'`, **When** they insert a reservation row, **Then** the insert succeeds.
2. **Given** a front_desk user, **When** they attempt to set `total_amount` on a pricing item to a discounted value, **Then** RLS blocks the update (requires pricing override permission).
3. **Given** a front_desk user, **When** they attempt to delete a reservation, **Then** RLS blocks the delete.
4. **Given** a manager user with `app_role = 'admin'`, **When** they cancel a reservation, **Then** the cancel succeeds.
5. **Given** an accountant user with `app_role = 'accountant'`, **When** they select reservation_payments, **Then** the select succeeds.
6. **Given** an accountant user, **When** they attempt to insert a reservation, **Then** RLS blocks the insert.

---

### User Story 2 - Field-Level and State-Based Security (Priority: P2)

Sensitive fields (pricing overrides, internal notes, guarantee details) are protected so only authorized roles can read or write them. Reservation state transitions are enforced — checked-out reservations cannot be modified, and no-show billing is applied only once.

**Why this priority**: The reservation FSM already enforces state transitions in application code, but database-level protection prevents bypass via direct API calls. Field-level protection ensures pricing integrity and confidentiality of internal notes.

**Independent Test**: An admin can update pricing fields on a confirmed reservation. A front_desk user cannot. Once a reservation is checked_out, no user can modify room assignments or amounts.

**Acceptance Scenarios**:

1. **Given** a confirmed reservation with pricing items, **When** a front_desk user attempts to UPDATE `unit_price` on a pricing item, **Then** RLS blocks the update (delegated to override_pricing permission).
2. **Given** a front_desk user, **When** they attempt to UPDATE `internal_notes` on a reservation, **Then** RLS blocks the update (manager-only field).
3. **Given** a checked_out reservation, **When** any user attempts to UPDATE reservation_room status, **Then** RLS blocks the update (terminal state).
4. **Given** a no_show reservation, **When** the system attempts to insert a no-show billing line, **Then** the insert succeeds (system-level operation).
5. **Given** any reservation, **When** a user attempts to UPDATE `deleted_at` directly, **Then** RLS blocks it (soft-delete managed by RPC).

---

### User Story 3 - RLS Policy Verification and Security Audit (Priority: P3)

The DBA or security reviewer can verify that every table has appropriate RLS policies, every policy is correctly scoped, and no authentication bypass is possible. Sensitive mutations are audited at the database level.

**Why this priority**: RLS policies are only effective if correctly applied. Verification ensures no table was missed, no policy is too permissive, and all write operations are captured in the audit log. This is critical for compliance and operational security.

**Independent Test**: A reviewer can enumerate all reservation-related tables, confirm RLS is enabled on each, and run a test script that exercises each policy combination (role × operation × state) to verify correct behavior.

**Acceptance Scenarios**:

1. **Given** the reservation schema, **When** a reviewer queries all tables in the public schema, **Then** every reservation table has `row_level_security_enabled = true`.
2. **Given** the RLS policy set, **When** a reviewer queries `pg_policies`, **Then** every table has at least one policy for each DML operation (SELECT, INSERT, UPDATE, DELETE) that is logically possible.
3. **Given** a reservation write operation, **When** it succeeds, **Then** an audit log entry is created in the audit_logs table.
4. **Given** an unauthenticated (anon) user, **When** they attempt any operation on a reservation table, **Then** the default-deny policy blocks the request.

---

### Edge Cases

- What happens when a front_desk user has `created_by` set to their own profile? UPDATE policies should still block pricing override via column-level checks.
- What happens when the `app_role` claim is missing from the JWT (e.g., malformed auth session)? The `current_app_role()` function should return NULL/fallback, and all policies should fail closed (deny).
- What happens when a reservation transitions to checked_out but a pricing item is added afterward? RLS should block additional pricing items on checked_out reservations.
- What happens when a no_show billing insert races with a manual cancellation? The RPC should use a transaction with status check to prevent double-billing.
- What happens when a user's role is changed mid-session? The `current_app_role()` reads from the JWT — changes take effect on next login (acceptable for admin system).
- What happens when an RPC (confirm, cancel, availability) is called directly via the API without proper permissions? Each RPC should call `can_write_reservations()` or equivalent internally before executing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: RLS policies MUST distinguish between SEL (read staff), INS (writers), UPD (writers + sensitive ops), and DEL (admin only) for each table.
- **FR-002**: Write operations on pricing-sensitive columns (`unit_price`, `discount_percentage`, `tax_rate`, `subtotal_amount`, `total_amount`, `balance_amount`) MUST require `can_override_pricing()`.
- **FR-003**: Write operations on `internal_notes`, `guarantee_type`, and `deleted_at` fields MUST require admin-level permission.
- **FR-004**: Manager-only permissions (cancel, override_price, override_deposit, force_assign_room, assign_dirty_room, assign_maintenance_room, company_credit_override, refund_payment) MUST be enforced by distinct RLS helpers or policy expressions.
- **FR-005**: DELETE policies on all reservation tables MUST be restricted to admin role only.
- **FR-006**: UPDATE policies on checked_out, cancelled, or no_show reservations MUST deny modification of room assignments and amounts (terminal state protection).
- **FR-007**: All RPCs (confirm_reservation, cancel_reservation, get_room_availability, check_in, check_out) MUST call `can_write_reservations()` or a more specific helper before executing.
- **FR-008**: The `current_app_role()` helper MUST return NULL (fail closed) when called without an authenticated session.
- **FR-009**: Every reservation-related table MUST have RLS enabled — verification MUST be scriptable via `pg_tables` and `pg_policies`.
- **FR-010**: Audit log entries MUST be written via application-level code (API services calling audit_log insert) for every reservation INSERT, UPDATE, and DELETE, capturing the actor ID, action, affected table, and primary key.
- **FR-011**: The can_read_reservations() helper MUST remain inclusive of admin, accountant, and front_desk — read-only access for accountants is correct.
- **FR-012**: The can_write_reservations() helper MUST restrict to admin and front_desk — pricing override and other sensitive operations use separate helpers.

### Key Entities *(include if feature involves data)*

All entities are the same as those defined in Phase 2 (004-supabase-schema-design/data-model.md). This phase adds no new tables — only RLS policy refinements:

- **Reservations** — SELECT for staff, INSERT/UPD for writers, UPD for pricing fields requires override, DEL for admin only. Terminal state protection on UPD.
- **Reservation Rooms** — Same pattern, plus `force_assign_room` permission for assigning dirty/maintenance rooms.
- **Reservation Guests** — Standard SELECT/INSERT/UPD/DEL pattern; no special columns.
- **Reservation Company Info** — Standard pattern; `company_credit_override` permission on UPD.
- **Reservation Pricing Items** — SELECT for staff, but UPDATE/DELETE on amounts requires `can_override_pricing()`.
- **Reservation Payments** — SELECT for staff, INSERT for `record_payment`, DEL for `refund_payment` (admin/manager). Only payment metadata stored (amount, method, reference ID) — no raw card data.
- **Reservation Holds** — Standard pattern.
- **Reservation Notes** — SELECT for staff, INSERT/UPD for writers; `internal_notes` column uses separate helper.
- **Reservation Status History** — INSERT-only (append-only log), SELECT for staff.
- **Room Status History** — INSERT-only (append-only log), SELECT for staff.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A test script exercising every (role × table × operation) combination produces exactly the expected allow/deny outcomes with zero unexpected passes.
- **SC-002**: Every reservation table has RLS enabled — verified by automated query.
- **SC-003**: Each policy correctly maps to the permission matrix (front_desk: 7 basic ops, manager: 8 sensitive ops, accountant: read-only) — no policy grants broader access than specified.
- **SC-004**: Pricing-sensitive columns are protected from front_desk writes — verified by UPDATE test from front_desk session.
- **SC-005**: Terminal-state protection blocks updates — verified by UPDATE test on checked_out reservation.
- **SC-006**: Audit log captures all reservation INSERT/UPDATE/DELETE with actor and timestamp — verified by comparing operations to log entries.

## Assumptions

- The existing `app_role` enum and `current_app_role()` function are already deployed and functional. This phase reuses them for policy expressions.
- The existing `can_read_reservations()` and `can_write_reservations()` helpers remain as base chevrons — this phase adds granular helpers for specific permissions.
- The project uses Option A (API-only writes) as the primary auth strategy — RLS is defense-in-depth, not the sole security barrier.
- RLS policy complexity is acceptable — this phase may introduce up to 40 individual policies across 9 tables (SELECT/INSERT/UPD/DEL per table with specialized variants).
- The existing audit_logs table is already in use — audit entries are written by application-level code (API services), NOT by database triggers. This phase does not create audit triggers.
- Role assignments in the JWT are authoritative — this phase does not add a secondary role lookup table.
- The `app_role` enum currently supports: admin, front_desk, accountant — this phase does NOT add `manager` or other new roles; policies map to the existing three roles.
- No raw payment card data (PAN, CVV) is stored in the database — payments are processed by a third-party processor. `reservation_payments` stores only metadata (amount, method, reference ID, timestamp). PCI-DSS-specific access isolation is not required.

## Clarifications

### Session 2026-06-28

- Q: Does this hotel system process actual payment card data (PAN, CVV) triggering PCI-DSS compliance requirements? → A: No — payments handled by third-party processor. Only payment metadata (amount, method, reference ID) stored in reservation_payments. No raw card data. RLS is standard defense-in-depth with no PCI-DSS-specific isolation required.
- Q: Should reservation audit logging be application-level (existing pattern) or trigger-based? → A: Application-level — API services call audit_log insert after each mutation (existing pattern). No database triggers for audit.
- Q: Should SELECT on sensitive columns (pricing, internal_notes) be logged in audit_logs? → A: No — log only INSERT/UPDATE/DELETE. Mutation audit is sufficient for this internal admin system.
