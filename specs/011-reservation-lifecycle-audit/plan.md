# Implementation Plan: Reservation Lifecycle Services & Audit Logs

**Branch**: `011-reservation-lifecycle-audit` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-reservation-lifecycle-audit/spec.md`

## Summary

Enhance the existing reservations module (services, validation, API routes, types) to add strict permission-checking, transactional audit logging, hold expiry cleanup, room change and stay extension services, no-show grace period enforcement, and audit retention. The project already has a comprehensive reservations codebase — this phase extends existing patterns without rewriting.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Next.js 16 (App Router, RSC), React 19

**Primary Dependencies**: Supabase (Auth + Database + Admin SDK), Zod (validation), Redux Toolkit 2 + React Redux 9

**Storage**: Supabase/Postgres — existing `reservations`, `reservation_rooms`, `reservation_guests`, `reservation_company_info`, `reservation_pricing_items`, `reservation_payments`, `reservation_holds`, `reservation_notes`, `reservation_status_history`, `audit_logs` tables

**Testing**: Vitest (unit/integration) + Playwright (E2E)

**Target Platform**: Web — Next.js server routes + Supabase Postgres RPCs

**Project Type**: Web application (Next.js App Router frontend + Supabase backend)

**Performance Goals**: Lifecycle actions complete in under 2s p95; up to 20 concurrent front desk users

**Constraints**: <200ms p95 for read queries (availability, history); transactional writes for critical mutations; audit log writes are synchronous and cause rollback on failure

**Scale/Scope**: Single-property hotel; up to 20 concurrent front desk users; ~20 audit event types; 1-year rolling audit retention

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate I — Database-First with Migrations
- **PASS**: All schema changes use Supabase migrations. Existing `audit_logs` table already exists. Any new columns or tables will be added via migration.

### Gate II — Strict Layered Architecture
- **PASS**: Existing architecture follows `UI Component → Hook → RTK Slice → Service → Supabase/API`. This phase extends existing services and API routes — no new layers introduced.

### Gate III — TypeScript Strictness & Validation
- **PASS**: Existing code uses strict TypeScript with Zod validation. This phase extends validation schemas.

### Gate IV — Security, RBAC & Audit
- **PASS** (with action item): Existing code has an RBAC system (`config/actionPermissions.ts`, `config/rbac.ts`) and audit service (`auditService.ts`). This phase adds permission checks to lifecycle services and makes audit logging transactional. **Action: Verify `canPerformAction` pattern in existing API routes and apply consistently.**

### Gate V — Code Quality & Performance
- **PASS**: Existing code follows conventions. `console.log` removal will be checked. `pnpm lint` and `pnpm build` required before merge.

## Project Structure

### Documentation (this feature)

```
specs/011-reservation-lifecycle-audit/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
├── spec.md              # Feature specification
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```
src/modules/reservations/
├── types.ts                   # Existing — extend permission types
├── constants.ts               # Existing — update hold duration to 30min default
├── validation.ts              # Existing — extend no-show grace period validation
├── services/
│   ├── reservationService.ts  # Existing — add permission checks, room change, stay extension
│   ├── auditService.ts        # Existing — make transactional with error propagation
│   ├── statusService.ts       # Existing — add permission check
│   ├── availabilityService.ts # Existing — add hold expiry cleanup inline
│   └── pricingService.ts      # Existing — stub method already present
│   └── index.ts               # Existing — update exports
├── hooks/                     # Existing — no changes expected
└── index.ts                   # Existing — no changes expected

src/config/
├── actionPermissions.ts       # Existing — add reservation lifecycle permissions
├── permissions.ts             # Existing — add reservation module actions
└── access.ts                  # Existing — extend if needed

src/app/api/reservations/
├── route.ts                   # Existing — add audit logging to draft creation
├── [id]/route.ts              # Existing — no changes expected
├── availability/route.ts      # Existing — no changes expected
├── [id]/hold/route.ts         # Existing — add permission check
├── [id]/release-hold/route.ts # Existing — add permission check
├── [id]/confirm/route.ts      # Existing — add permission check + hold revalidation
├── [id]/cancel/route.ts       # Existing — add permission check
├── [id]/check-in/route.ts     # Existing — add permission check
├── [id]/check-out/route.ts    # Existing — add permission check
├── [id]/no-show/route.ts      # NEW — POST /api/reservations/[id]/no-show
├── [id]/rooms/route.ts        # NEW — POST, PATCH, DELETE for room changes
├── [id]/extend/route.ts       # NEW — POST /api/reservations/[id]/extend
└── [id]/payments/route.ts     # Existing — add permission check

supabase/migrations/
└── YYYYMMDDHHMMSS_audit_retention_and_holds.sql  # NEW — audit retention index, hold cleanup

src/modules/logs/              # Existing — extend if needed
```

**Structure Decision**: Single web application with existing modular structure. All changes stay within `src/modules/reservations/`, `src/config/`, and `src/app/api/reservations/`. Supabase migrations for any schema additions.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — all gates pass.

## Phases

### Phase 0: Research

Before implementation, research the following:

1. **Existing permission patterns** — Inspect `src/config/actionPermissions.ts` and `src/config/access.ts` to understand `canPerformAction` usage patterns in existing API routes for consistent application.
2. **Existing Supabase RPCs** — Inspect the `confirm_reservation` and `cancel_reservation` RPCs to understand their current implementation and whether they need updates.
3. **Audit log table structure** — Inspect `audit_logs` table schema via Supabase MCP to understand existing columns, indexes, and whether retention/partitioning is already in place.
4. **Existing API route patterns** — Read a few existing API routes (e.g., `rooms/route.ts`) to understand the exact permission-checking and session-verification pattern used.
5. **Hold overlap / exclusion constraint** — Check whether the `reservation_rooms` table already has the exclusion constraint or if conflict prevention relies entirely on the RPC.

### Phase 1: Design & Contracts

1. **Data model:** Document current entity relationships and identify which tables need new columns or indexes.
2. **Contracts:** Document the API contract for new endpoints (no-show, room change, stay extension).
3. **Quickstart:** Validation scenarios for the enhanced lifecycle services.

### Phase 2: Tasks

Defined by `/speckit.tasks` command.
