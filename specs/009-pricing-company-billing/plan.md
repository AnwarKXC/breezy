# Implementation Plan: Pricing and Company Billing

**Branch**: `009-pricing-company-billing` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-pricing-company-billing/spec.md`

## Summary

Implement explainable per-room pricing with seasonal and room-specific rates, company billing rules and payer assignment, and manual price overrides with full audit trail. New tables: `seasonal_rates`, `room_specific_rates`. Extended: `reservations` (billing_type, split_percentage), `reservation_pricing_items` (source tracking). Pricing is locked at confirmation — recalculation only applies to drafts.

## Technical Context

**Language/Version**: PostgreSQL 15 (PL/pgSQL) via Supabase

**Primary Dependencies**: Supabase/Postgres — existing tables (reservations, reservation_pricing_items, company_price_overrides, room_types, rooms, contacts as companies)

**Storage**: PostgreSQL — new tables: `seasonal_rates`, `room_specific_rates`. Extended columns on `reservations` (billing_type enum, split_percentage), `reservation_pricing_items` (source_type, source_ref, rate_per_night_at_booking)

**Testing**: Manual SQL test scripts via Supabase SQL Editor (pgTAP deferred)

**Target Platform**: Supabase PostgreSQL 15+

**Project Type**: Backend — migration (2 new tables + column additions) + 3 RPCs + pricing recalculation logic

**Performance Goals**: Pricing breakdown query <3s for 5-night/2-room (SC-001). Override audit trail complete for every mutation (SC-003).

**Constraints**: Pricing locked at confirmation (clarify decision). Seasonal rates only affect pre-confirmation pricing. Manual overrides must be flagged for review on date/room changes.

**Scale/Scope**: ~100K reservations. 10-50 seasonal rates, 5-20 room-specific rates, 50-200 company overrides.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Notes |
|-----------|-------|-------|
| **I. Database-First with Migrations** | ✅ PASS | New tables + column additions through numbered migration. |
| **II. Strict Layered Architecture** | ✅ PASS | Backend-only — no UI layer affected. |
| **III. TypeScript Strictness & Validation** | ✅ N/A | No TypeScript code in this phase |
| **IV. Security, RBAC & Audit** | ✅ PASS | `can_override_pricing()` guard for manual overrides. Audit logging for all pricing changes (FR-013). |
| **V. Code Quality & Performance** | ✅ N/A | No application code. Pricing breakdown performance target in SC-001. |

**Gate verdict**: ✅ PASS — all constitutional principles satisfied. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-pricing-company-billing/
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
    └── 20260628000005_pricing_company_billing.sql   # Single migration

specs/009-pricing-company-billing/
└── ...  # (see above)
```

**Structure Decision**: Single migration file under `supabase/migrations/`. All documentation under `specs/009-pricing-company-billing/`. No TypeScript, no frontend changes.

## Complexity Tracking

No constitutional violations — Complexity Tracking table is empty.
