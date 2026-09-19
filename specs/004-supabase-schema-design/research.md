# Research: Supabase Schema Design

## Research Context

This feature implements Phase 2 from `docs/plans/reservation_model_supabase_mcp_plan.md` (Sections 5-13). The goal is to create the database schema for the reservation model. No technology unknowns exist — the reference plan provides detailed table definitions. This document records design decisions made during planning.

## Key Design Decisions

### Decision 1: Conflict Prevention Strategy

- **Decision**: Use BOTH a Postgres exclusion constraint with `btree_gist` AND a transactional RPC for double booking prevention.
- **Rationale**: Defense-in-depth. The exclusion constraint (`reservation_rooms_no_overlap`) prevents overlapping active room assignments at the database level using a GiST index on `daterange()` — this is the strongest possible guarantee. The `confirm_reservation` transactional RPC provides an additional application-layer check that validates no conflicts exist before transitioning to confirmed status. The `btree_gist` extension is installed via the migration.
- **Alternatives considered**: Transactional RPC only — would provide safety but lacks the database-level enforcement that prevents race conditions between two concurrent operations.

### Decision 2: Status Field Approach

- **Decision**: Use Postgres `enum` types for reservation status fields.
- **Rationale**: Type safety at the database level — prevents invalid status values from being inserted. The existing project already uses Postgres enums (`public.app_role`, `public.log_action`). The migration creates dedicated enums for each dimension: `reservation_status`, `reservation_booking_type`, `billing_party`, `reservation_source`, `reservation_room_status`, `reservation_guest_role`, `reservation_payment_type`, `reservation_payment_method`, `price_source`, `room_physical_status`. New values can be added via `ALTER TYPE ... ADD VALUE` (non-blocking in Postgres 12+).
- **Alternatives considered**: `text` with `CHECK` constraints — easier to modify but less type-safe and inconsistent with existing project conventions.

### Decision 3: RLS Strategy

- **Decision**: Create RLS policies on all 9 tables, but rely primarily on application-layer permission checks via the service-role client. RLS provides defense-in-depth.
- **Rationale**: The project uses API-only writes (service-role client from Next.js API routes). RLS policies serve as a safety net rather than the primary authorization mechanism. This follows the constitution's Principle IV (defense-in-depth) while keeping the primary auth path simple.
- **Alternatives considered**: No RLS (service-role only) — simpler but lacks defense-in-depth. Full RLS (browser client writes directly) — not compatible with the existing architecture.

### Decision 4: Migration Granularity

- **Decision**: One migration file per table (9 files) plus separate files for indexes and RLS, applied in dependency order.
- **Rationale**: Each migration is small, reviewable, and independently reversible. Error in one migration does not block the entire schema. Follows Supabase best practices for migration management.
- **Alternatives considered**: Single large migration — faster to apply but harder to review and debug.

### Decision 5: Reservation Number Format

- **Decision**: Use `text` with a trigger or application-generated unique number. Format: sequential number prefixed with "RSV-" (e.g., RSV-1001).
- **Rationale**: Human-readable reservation numbers are standard in hotel front desk systems. Prefix + sequential number is recognizable and sortable. Unique constraint enforced at the database level.
- **Alternatives considered**: UUID — unique but not human-friendly. Auto-increment integer — simple but less professional appearance.

### Decision 6: Audit Log Integration

- **Decision**: Audit events for reservation operations will use the existing `audit_logs` table pattern (not a separate audit schema). The `reservation_status_history` table tracks internal status transitions; the audit log captures the user-facing business event.
- **Rationale**: Avoids duplicating the audit system. The status history is a schema-level immutable log of state changes; the audit log is higher-level business event tracking. Both are needed for different purposes.
- **Alternatives considered**: Writing all events to status_history only — loses the distinction between internal state transitions and user-facing business events.

## Reference Documents

- `docs/plans/reservation_model_supabase_mcp_plan.md` — Sections 5-13 (Phase 2 table definitions), Section 15 (RLS), Section 26 (migration rollout)
- `specs/004-supabase-schema-design/spec.md` — Feature specification (3 user stories, 15 FRs)
- `.specify/memory/constitution.md` — Project architecture and governance rules
- `specs/003-code-database-audit/plan.md` — Audit plan (must complete before schema decisions)
