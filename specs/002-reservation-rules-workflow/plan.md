# Implementation Plan: Reservation Rules and MCP Workflow

**Branch**: `002-reservation-rules-workflow` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-reservation-rules-workflow/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command.

## Summary

Create a developer reference artifact set that codifies the 14 non-negotiable reservation rules, the Supabase MCP database inspection workflow (with fallback), and the target domain model (statuses, booking types, billing parties, room assignment/ physical statuses). This is a documentation/standards feature — its deliverables are reference documents that developers follow when implementing reservation features.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16 (App Router, RSC), React 19

**Primary Dependencies**: Supabase (Auth, Database, Admin SDK), Zod 4, Redux Toolkit 2

**Storage**: Supabase/Postgres — service-role client for server-only operations, publishable key for browser clients

**Testing**: Vitest (unit/integration) + @testing-library/react + @testing-library/jest-dom; Playwright (E2E)

**Target Platform**: Web — hotel front desk dashboard (desktop + mobile responsive)

**Project Type**: Web application (Next.js full-stack)

**Performance Goals**: N/A — this feature produces developer reference documents, not runtime code

**Constraints**: All reference documents must be consistent with the existing codebase patterns found in `src/modules/reservations/` and `src/app/api/reservations/`

**Scale/Scope**: Medium — 30-100 rooms, 50-200 reservations/day, 10-30 concurrent front desk users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gates

| Constitution Principle | Compliance Check | Status |
|------------------------|-----------------|--------|
| I. Database-First with Migrations | Every schema change MUST use numbered Supabase migrations. | ✅ Pass (FR-001, FR-002) |
| I. Database-First with Migrations | Double booking MUST be prevented at database/service level, not frontend alone. | ✅ Pass (FR-004) |
| II. Strict Layered Architecture | UI → Hook → RTK → Service → Supabase/API flow enforced. | ✅ Pass (non-negotiable rules align with existing architecture) |
| III. TypeScript Strictness & Validation | Zod validation for all inputs. No `as any`/`@ts-ignore`. | ✅ Pass (FR-007 + existing patterns) |
| IV. Security, RBAC & Audit | Session + permission checks on every write. Audit logs for all sensitive actions. | ✅ Pass (FR-006, FR-007) |
| IV. Security, RBAC & Audit | Reservation/business-critical mutations MUST use transactions/RPCs. | ✅ Pass (FR-004) |
| V. Code Quality & Performance | ESLint clean, build passes, i18n keys for all user-facing text. | ✅ Pass (implicit in existing patterns) |

**Gate Result**: ✅ All constitutional gates pass. No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-reservation-rules-workflow/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output — existing codebase audit vs rules
├── data-model.md        # Phase 1 output — domain model reference
├── quickstart.md        # Phase 1 output — rule/scenario validation guide
├── contracts/           # Phase 1 output — MCP workflow & audit contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

This feature produces no source code changes — it creates developer reference documents. The documents reference existing source paths:

```text
src/
├── modules/reservations/        # Existing module to analyze
├── app/api/reservations/        # Existing API routes to analyze  
├── config/actionPermissions.ts  # Existing permission actions
└── services/supabase/           # Existing database types
```

**Structure Decision**: Documentation-only feature. All artifacts live under `specs/002-reservation-rules-workflow/`. The documents describe how existing and future source code should behave, referencing real file paths in the codebase.

## Complexity Tracking

> Not needed — all constitutional gates pass without violations.

## Phase 0: Research & Audit

**Goal**: Audit existing `src/modules/reservations/` and `src/app/api/reservations/` against each of the 14 non-negotiable rules to determine which are already enforced and which need new implementation.

### Unknowns to Resolve
- Which of the 14 non-negotiable rules are already enforced in the existing codebase?
- Which reservations tables already exist in the Supabase schema?
- What is the exact MCP inspection checklist for this project's schema?
- How does the existing RBAC system map to the required reservation permissions?

### Research Tasks

1. Inspect `src/modules/reservations/` — types, services, validation, constants, hooks
2. Inspect `src/app/api/reservations/` — route handlers and middleware
3. Inspect `src/config/actionPermissions.ts` — existing permission actions
4. Inspect `src/services/supabase/database.types.ts` — existing DB types and enums
5. Map findings to the 14 non-negotiable rules from spec.md
6. Document decision: extend `bookings` table (from clarification Q1)

**Output**: `research.md`

## Phase 1: Design Reference Documents

**Prerequisites**: `research.md` complete

### 1. Data Model Reference (`data-model.md`)

Translate sections 3.1–3.5 of the spec into a structured reference:
- Reservation lifecycle statuses + strict transition map
- Reservation booking types with descriptions
- Billing parties and payment responsibility rules
- Room assignment status lifecycle (independent of reservation status)
- Physical room statuses (independent of assignment status)
- Relationship diagram between entities

### 2. Contract Documents (`contracts/`)

Create developer workflow contracts:
- `contracts/mcp-inspection.md` — MCP inspection checklist, questions, expected output format, fallback procedure
- `contracts/audit-events.md` — Required audit events, metadata shape, mapping to existing log system
- `contracts/permissions.md` — Required permission actions by role, mapping to existing actionPermissions

### 3. Quickstart Validation Guide (`quickstart.md`)

Scenarios to validate that an implementation follows the rules:
- Double booking prevention test
- Status transition validation test
- Price override audit trail test
- Hold expiry and release test
- Company billing party assignment test
- MCP inspection workflow test

### 4. Agent Context Update

Update `AGENTS.md` with speckit markers pointing to the plan file.
