# Feature Specification: Indexes and Performance

**Feature Branch**: `005-indexes-and-performance`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Phase 3 — Indexes and Performance from docs/plans/reservation_model_supabase_mcp_plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fast Reservation Lookups and Availability (Priority: P1)

The front desk user can search reservations and check room availability without noticeable delay, even as the reservation database grows. Queries for active reservations, date-range searches, and room availability complete quickly.

**Why this priority**: The core reservation schema (Phase 2) is already deployed. Without proper indexes, every front desk query will slow as data accumulates. Availability checks run on every booking conversation — speed here directly impacts guest service.

**Independent Test**: A user can search reservations by status, date range, and guest without experiencing more than 2 seconds of delay on a database with representative test data.

**Acceptance Scenarios**:

1. **Given** a database with reservations spanning multiple months, **When** the user searches for active reservations by status, **Then** results return in under 1 second.
2. **Given** a database with reservations, **When** the user searches for reservations within a date range, **Then** results return in under 1 second.
3. **Given** a database with room assignments, **When** the user checks room availability for a date range, **Then** the system returns available rooms in under 2 seconds.
4. **Given** active room holds in the database, **When** the user queries available rooms, **Then** held rooms are correctly excluded and available rooms are returned promptly.

---

### User Story 2 - Optimized Billing and Company Queries (Priority: P2)

The accountant or manager can efficiently query reservation data filtered by company, billing party, and payment status — with aggregations that complete without timeout.

**Why this priority**: Accounting and billing queries scan broader data ranges (month-end, quarterly). These queries involve joins across company info, pricing items, and payments — which require targeted indexes to avoid full table scans.

**Independent Test**: An accountant can run a billing report for a specific company covering the last month and see results within 5 seconds.

**Acceptance Scenarios**:

1. **Given** a database with multiple company reservations, **When** the accountant queries reservations by company, **Then** results return in under 2 seconds.
2. **Given** a database with pricing items and payments, **When** the accountant runs a billing summary per reservation, **Then** aggregated results return in under 5 seconds.
3. **Given** a database with historical data, **When** a payment reconciliation query runs (payments joined to reservations), **Then** it completes without timeout.

---

### User Story 3 - Query Performance Verification (Priority: P3)

The developer or DBA can verify that database indexes are correctly applied and actively used by the query planner. Slow queries can be identified and addressed.

**Why this priority**: Indexes are only effective if the query planner actually uses them. Verification and monitoring ensure that the investment in indexing delivers the expected performance improvement and that any missing indexes are discovered early.

**Independent Test**: A developer can run EXPLAIN ANALYZE on common reservation queries and confirm that index scans are used instead of sequential scans.

**Acceptance Scenarios**:

1. **Given** a database with the required indexes applied, **When** a developer runs EXPLAIN ANALYZE on a reservation status lookup, **Then** the query plan shows an index scan.
2. **Given** a database with the required indexes applied, **When** a developer runs EXPLAIN ANALYZE on a room availability query, **Then** the query plan shows an index scan.
3. **Given** slow query logs, **When** a developer identifies a frequently run query performing sequential scans, **Then** the missing index can be identified and added.

---

### Edge Cases

- What happens when a table has both partial indexes (WHERE deleted_at IS NULL) and full indexes? The query planner must select the correct partial index based on the query predicate.
- What happens when a reservation is soft-deleted (deleted_at set)? Partial indexes on `WHERE deleted_at IS NULL` should exclude deleted rows from scan range.
- What happens when the btree_gist exclusion constraint index on reservation_rooms conflicts with the room-dates B-tree index? The GIST index handles exclusion; the B-tree handles range queries — they serve different purposes and can coexist.
- What happens when a date range spans indexed partition boundaries? If the index is on `(check_in_date, check_out_date)`, a spanning query should still use the index effectively.
- What happens when a company has thousands of reservations over years? The partial index on `company_id WHERE company_id IS NOT NULL AND deleted_at IS NULL` targets only active, company-linked reservations.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support fast filtering by reservation status (active, cancelled, completed) via partial index.
- **FR-002**: System MUST support fast date-range searches on check-in and check-out dates.
- **FR-003**: System MUST support fast lookups of reservations by company (FK).
- **FR-004**: System MUST support fast lookups of reservations by primary guest (FK).
- **FR-005**: System MUST support fast room availability queries by room and date range (reservation_rooms).
- **FR-006**: System MUST support fast FK lookups from reservation_rooms to the parent reservation.
- **FR-007**: System MUST exclude soft-deleted rows from all reservation indexes where `deleted_at IS NULL` partial indexes are used.
- **FR-008**: System MUST support fast active hold lookups (by room, dates, and upcoming expiry).
- **FR-009**: System MUST support fast lookups from reservation_guests to parent reservation (FK).
- **FR-010**: System MUST support fast lookups of guest associations by guest ID.
- **FR-011**: System MUST support fast lookups of payments by reservation (FK).
- **FR-012**: System MUST support fast lookups of pricing items by reservation and by room (FK).
- **FR-013**: System MUST support fast status history traversal by reservation in reverse chronological order.
- **FR-014**: System MUST support fast notes lookup by reservation in reverse chronological order.
- **FR-015**: System MUST support fast room status history traversal by room in reverse chronological order.

### Key Entities *(include if feature involves data)*

All entities are the same as those defined in Phase 2 (004-supabase-schema-design/data-model.md). This phase adds no new tables — only indexes:

- **Reservations**: Partial indexes on status, dates, company, primary guest, created_by
- **Reservation Rooms**: Partial indexes on (room_id, dates), reservation_id, status
- **Reservation Guests**: Indexes on reservation_id, guest_id
- **Reservation Holds**: Partial index on active holds (room, dates, expires_at)
- **Reservation Payments**: Index on reservation_id
- **Reservation Pricing Items**: Indexes on reservation_id, reservation_room_id
- **Reservation Status History**: Index on (reservation_id, changed_at desc)
- **Reservation Notes**: Index on (reservation_id, created_at desc)
- **Room Status History**: Index on (room_id, changed_at desc)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All reservation status filters return results in under 1 second on a database with 10,000+ reservations.
- **SC-002**: All date-range reservation searches return results in under 2 seconds on a database with 10,000+ reservations.
- **SC-003**: Room availability queries return results in under 2 seconds on a database with 50,000+ room assignments.
- **SC-004**: Company-filtered reservation queries return in under 2 seconds on a database with 500+ companies.
- **SC-005**: All new indexes are confirmed present in the database schema — no missing indexes compared to the plan.
- **SC-006**: EXPLAIN ANALYZE confirms index scans (not sequential scans) for the primary query patterns: status filter, date range, company lookup, room availability, and FK joins.

## Assumptions

- The reservation schema migrations (Phase 2, spec 004) have been applied and all 9 reservation tables exist with at least 10,000 sample rows for performance testing.
- B-tree indexes are sufficient for the primary query patterns — no GIN, BRIN, or other index types are required unless query analysis demonstrates the need.
- Partial indexes (`WHERE deleted_at IS NULL`) are preferred over full-table indexes since soft deletion is the standard pattern and most queries target active rows.
- The existing `btree_gist` exclusion constraint index on reservation_rooms remains in place — this phase adds additional B-tree indexes for query performance, not conflict prevention.
- Performance targets assume standard Postgres configuration (shared_buffers, work_mem at default or typical cloud-hosted settings).
- The 3-year growth target is approximately 100,000 reservations. All indexes should be designed to keep queries performant at this volume without requiring partitioning.
- This phase does not include query rewriting, materialized views, or caching — purely index-based optimization.
- Index maintenance (dropping unused indexes, periodic reindexing, index usage monitoring queries or views) is out of scope for this phase. Index creation is one-time; ongoing maintenance and monitoring are deferred to operations.

## Clarifications

### Session 2026-06-28

- Q: Should this phase include index maintenance (dropping unused indexes, periodic reindexing)? → A: No — creation only, maintenance deferred to operations.
- Q: What is the 3-year reservation volume target for index design? → A: ~100K reservations — B-tree indexes sufficient, no partitioning needed.
- Q: Should this phase include setting up index usage monitoring queries or views? → A: No — monitoring is part of operations, out of scope for this phase.
