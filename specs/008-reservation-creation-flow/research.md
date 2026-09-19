# Research: Reservation Creation and Hold Flow

**Feature**: 008-reservation-creation-flow | **Phase**: 0 — Architecture Research

## Decision 1: RPC Architecture — Separate vs Combined

- **Decision**: Three separate RPCs: `create_draft_reservation`, `release_hold`, `confirm_reservation`. Each handles a distinct state transition.
- **Rationale**: Separation keeps each RPC focused and testable. `create_draft_reservation` handles the draft+hold creation in one transaction (but as a single operation, not confirmation-level complexity). `release_hold` is a simple status update with ownership validation. `confirm_reservation` is the complex atomic operation with re-validation. Combined would create a monolith harder to debug.
- **Alternatives considered**:
  - Single mega-RPC with operation parameter — rejected for complexity and harder to test independently.
  - Application-layer transaction spanning multiple RPC calls — rejected for race conditions between calls.

## Decision 2: Atomic Confirmation — Exception Handling Pattern

- **Decision**: `confirm_reservation` uses a PL/pgSQL `BEGIN ... EXCEPTION WHEN OTHERS THEN ROLLBACK` pattern inside a `security definer` function wrapping the entire operation.
- **Rationale**: PostgreSQL functions run in an implicit transaction. The function uses `BEGIN`/`EXCEPTION` to catch failures, roll back all changes, and return a structured JSON error response showing which rooms failed. This meets FR-008 (atomic) and FR-009 (report per-room failures).
- **Alternatives considered**:
  - Application-level transaction — rejected for network round-trip risk between operations.
  - SAVEPOINT per room — unnecessary complexity since all-or-nothing is required.

## Decision 3: Hold Collision Detection — FOR UPDATE NOWAIT

- **Decision**: Use `SELECT ... FROM reservation_holds WHERE room_id = X AND status = 'active' AND expires_at > now() FOR UPDATE NOWAIT` to detect and prevent concurrent hold creation on the same room.
- **Rationale**: `FOR UPDATE NOWAIT` immediately fails if another transaction holds a conflicting row lock, meeting the 100% collision detection requirement (SC-003). This is simpler and more reliable than advisory locks.
- **Alternatives considered**:
  - Advisory locks (`pg_try_advisory_lock`) — rejected for complexity and risk of orphaned locks.
  - Optimistic locking (version column + retry) — rejected because hold collisions are rare but critical; pessimistic locking is simpler.

## Decision 4: Hold Expiry — Filter-Only Approach

- **Decision**: Expired holds are not cleaned up by a background job. Availability queries filter out holds where `expires_at <= now()` or `status != 'active'`. A lightweight check in the confirmation RPC catches expired holds at validation time.
- **Rationale**: Filter-only avoids scheduled job infrastructure (cron, pg_cron extensions). Holds are short-lived (30min default), so stale rows are minimal. The `status` column is updated to `expired` only when a query or confirmation touches an expired hold (lazy update).
- **Alternatives considered**:
  - pg_cron scheduled cleanup job — rejected for requiring extension setup and maintenance.
  - `ON UPDATE` trigger to auto-expire — rejected for adding trigger complexity to a simple status check.

## Decision 5: State Machine — CHECK Constraints + Application Validation

- **Decision**: Reservation status transitions enforced via CHECK constraint on the `reservations.status` column combined with application validation in the RPC. Reservation_holds status uses a simple CHECK constraint allowing `active`, `expired`, `released`.
- **Rationale**: CHECK constraints provide database-level safety against invalid states. The RPC logic validates the transition is valid before executing. This dual-layer approach prevents data corruption from direct SQL access.
- **Transition rules** (via RPC validation):
  - `draft` → `held`: On successful confirmation
  - `draft` → `cancelled`: User abandons (handled by explicit cancel or expiry)
  - Only these transitions are allowed at the database level.
- **Alternatives considered**:
  - Full FSM table with allowed transitions — rejected for this phase; simple enough for CHECK constraint.

## Decision 6: Permission Guard — Reuse Phase 6 Helpers

- **Decision**: Reuse `can_read_reservations()` for read access and `can_write_reservations()` for write access from Phase 6. The create/release/confirm RPCs call `can_write_reservations()` at entry.
- **Rationale**: Phase 6 already defines the 3-role model (admin, accountant, front_desk). Reusing existing helpers avoids duplicating role logic and stays consistent with the RLS architecture.
- **Alternatives considered**:
  - New helper `can_manage_holds()` — rejected as unnecessary since the clarify decision confirmed front_desk + admin = full write access, which maps exactly to `can_write_reservations()`.

## Decision 7: Input Validation — Typed Parameters + Application Checks

- **Decision**: All RPCs use strongly-typed parameters (uuid, date, int, etc.). Application validation inside the function body checks business rules (e.g., dates valid, room exists, hold not expired). No dynamic SQL.
- **Rationale**: Typed parameters prevent SQL injection by design (PostgreSQL enforces type casting). Business rule validation inside the function catches invalid operations before they touch data.
- **Validation checks per RPC**:
  - `create_draft_reservation`: guest exists, dates valid (check_in < check_out), rooms exist and not under maintenance, no conflicting holds
  - `release_hold`: hold exists, hold owner matches current user, hold is active
  - `confirm_reservation`: reservation exists in 'draft' status, all holds active and owned by current user, no date overlaps, rooms not under maintenance
