# Implementation Plan: Reservation Creation and Hold Flow

**Branch**: `008-reservation-creation-flow` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-reservation-creation-flow/spec.md`

## Summary

Enable front desk staff to create draft reservations with active room holds, manage hold lifecycles (expiry/release), and atomically confirm reservations with conflict re-validation. This is a backend-only phase: two new RPCs (`create_draft_reservation`, `confirm_reservation`), one enhanced RPC (`release_hold`), and a migration for schema additions.

## Technical Context

**Language/Version**: PostgreSQL 15 (PL/pgSQL) via Supabase

**Primary Dependencies**: Supabase/Postgres — existing tables (reservations, reservation_rooms, reservation_holds, reservation_status_history, audit_log)

**Storage**: PostgreSQL — existing schema. Potential additions: `expires_at` column on reservation_holds if not already present, `can_read_reservations()` permission guard from Phase 6.

**Testing**: Manual SQL test scripts via Supabase SQL Editor (pgTAP deferred)

**Target Platform**: Supabase PostgreSQL 15+

**Project Type**: Backend — three RPCs + migration

**Performance Goals**: Confirmation RPC <3s for 5 rooms (SC-004). Hold collision detection 100% (SC-003).

**Constraints**: Atomic transaction for confirmation (FR-008). All-or-nothing per clarify decision. Holds always require a parent reservation_id (NOT NULL). Front_desk + admin = full access, accountant = read-only.

**Scale/Scope**: ~100K reservations. Existing B-tree indexes sufficient.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Notes |
|-----------|-------|-------|
| **I. Database-First with Migrations** | ✅ PASS | All changes through numbered Supabase migration. No raw DDL. |
| **II. Strict Layered Architecture** | ✅ PASS | Backend-only — no UI layer affected. RPCs called from application service layer. |
| **III. TypeScript Strictness & Validation** | ✅ N/A | No TypeScript code in this phase |
| **IV. Security, RBAC & Audit** | ✅ PASS | RPCs use `security definer` + `can_write_reservations()` guard. All state changes audited (FR-011). Role-based access (FR-010). |
| **V. Code Quality & Performance** | ✅ N/A | No application code. Performance targets in SC-003, SC-004. |

**Gate verdict**: ✅ PASS — all constitutional principles satisfied. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/008-reservation-creation-flow/
├── plan.md              # This file
├── research.md          # Architecture decisions (Phase 0)
├── data-model.md        # Entity definitions and state machines (Phase 1)
├── quickstart.md        # Validation scenarios (Phase 1)
├── contracts/           # RPC contracts (Phase 1)
└── tasks.md             # Implementation tasks (Phase 2 — /speckit.tasks)
```

### Source Code (repository root)

```text
supabase/
└── migrations/
    └── 20260628000004_reservation_creation_hold_flow.sql   # Single migration

specs/008-reservation-creation-flow/
└── ...  # (see above)
```

**Structure Decision**: Single migration file under `supabase/migrations/`. All documentation under `specs/008-reservation-creation-flow/`. No TypeScript, no frontend changes.

## Complexity Tracking

No constitutional violations — Complexity Tracking table is empty.
