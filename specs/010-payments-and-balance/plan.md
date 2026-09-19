# Implementation Plan: Payments and Balance

**Branch**: `010-payments-and-balance` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-payments-and-balance/spec.md`

## Summary

Implement payment recording (deposit, partial, full), balance tracking, refunds, deposit policy enforcement, and guarantee-only bookings. New table: `reservation_payments`. New config table: `deposit_policy_rules`. Extended: `reservations` (paid_amount, balance_amount sync via RPC). Payment status lifecycle: `pending → paid/failed → refunded`.

## Technical Context

**Language/Version**: PostgreSQL 15 (PL/pgSQL) via Supabase

**Primary Dependencies**: Supabase/Postgres — existing tables (reservations, reservation_pricing_items, contacts as companies)

**Storage**: PostgreSQL — new tables: `reservation_payments`, `deposit_policy_rules`. Extended columns: none on reservations (paid_amount/balance_amount already exist per plan).

**Testing**: Manual SQL test scripts via Supabase SQL Editor (pgTAP deferred)

**Target Platform**: Supabase PostgreSQL 15+

**Project Type**: Backend — migration (2 new tables) + 3 RPCs + transactional payment processing

**Performance Goals**: Payment recording completes in <3s (SC-001). Balance updates immediately — verified within 1s after RPC call (SC-002).

**Constraints**: Concurrent payment safety via transactional RPC + SELECT FOR UPDATE (clarify Q4). Overpayment blocked unless explicitly permitted (FR-005). Refunds must reference original payment (FR-007). Payment status lifecycle must enforce valid transitions.

**Scale/Scope**: ~100K reservations, ~200K payment records, 10-50 deposit policy rules.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Notes |
|-----------|-------|-------|
| **I. Database-First with Migrations** | ✅ PASS | New `reservation_payments` and `deposit_policy_rules` tables through numbered migration. |
| **II. Strict Layered Architecture** | ✅ PASS | Backend-only — no UI layer affected. |
| **III. TypeScript Strictness & Validation** | ✅ N/A | No TypeScript code in this phase |
| **IV. Security, RBAC & Audit** | ✅ PASS | Transactional RPCs with permission checks. Audit logging for all payment events (FR-013). |
| **V. Code Quality & Performance** | ✅ N/A | No application code. |

**Gate verdict**: ✅ PASS — all constitutional principles satisfied. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/010-payments-and-balance/
├── plan.md              # This file
├── research.md          # Architecture decisions (Phase 0)
├── data-model.md        # New entities + extended tables (Phase 1)
├── quickstart.md        # Validation scenarios (Phase 1)
├── contracts/           # RPC contracts (Phase 1)
└── tasks.md             # Implementation tasks (Phase 2 — /speckit.tasks)
```

### Source Code (repository root)

```text
supabase/
└── migrations/
    └── 20260628000006_payments_and_balance.sql   # Single migration

specs/010-payments-and-balance/
└── ...  # (see above)
```

**Structure Decision**: Single migration file under `supabase/migrations/`. All documentation under `specs/010-payments-and-balance/`. No TypeScript, no frontend changes.

## Complexity Tracking

No constitutional violations — Complexity Tracking table is empty.
