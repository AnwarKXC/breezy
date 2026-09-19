# Implementation Plan: Existing Code and Database Audit

**Branch**: `003-code-database-audit` | **Date**: 2026-06-28 | **Spec**: `specs/003-code-database-audit/spec.md`

**Input**: Feature specification from `/specs/003-code-database-audit/spec.md`

## Summary

Analyze the existing hotel-system codebase and Supabase database to produce a documented inventory of current reservation-related modules, schema, relationships, permissions, and audit capabilities. Deliver reuse/extend/create decisions for the target reservation model (9 entities) plus a migration impact list and risk assessment — ensuring all downstream phases build on accurate knowledge of what already exists.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16, React 19) — per constitution

**Primary Dependencies**: Supabase (Auth, Database, Admin SDK), MCP tools for schema inspection, Supabase CLI (`supabase db inspect`) as fallback

**Storage**: Supabase/Postgres — read-only schema inspection; no migrations or writes during this phase

**Testing**: Not applicable — this is a documentation/analysis phase, not a feature implementation

**Target Platform**: Existing hotel-system repository (no new platform targets)

**Project Type**: Web application (Next.js App Router) — audit examines existing `src/modules/*` and `src/app/api/*`

**Performance Goals**: Not applicable — no runtime performance targets for an analysis phase

**Constraints**: 
- Read-only: no schema changes, no data mutations, no file modifications outside `specs/003-code-database-audit/findings/`
- No PII may be read or copied — schema metadata and FK relationships only
- MCP → Supabase CLI → direct `information_schema` SQL fallback chain for database inspection
- Code inspection depth: exports, types, and key function signatures only

**Scale/Scope**: 
- 10 code module areas to inspect
- ~15 database tables to examine
- 9 target reservation entities to assess for reuse/extend/create
- Expected findings documents: 5+ files under `specs/003-code-database-audit/findings/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| **I. Database-First with Migrations** | Read-only audit — no migrations, no schema changes. Inspection adheres to DB-first principle by consulting the actual database. | ✅ PASS |
| **II. Strict Layered Architecture** | Existing code is examined; no new layers, modules, or architectural changes introduced. | ✅ PASS |
| **III. TypeScript Strictness & Validation** | TypeScript types are inspected but no new code is written. No `as any`, `@ts-ignore`, or violations introduced. | ✅ PASS |
| **IV. Security, RBAC & Audit** | RLS policies and permission actions are explicitly inspected and flagged. PII is protected (not read). Security gaps are documented as risks. | ✅ PASS |
| **V. Code Quality & Performance** | Missing constraints and performance risks are flagged in the risk assessment. No `console.log` or ESLint violations introduced. | ✅ PASS |
| **Development Workflow** | Findings are committed to the feature directory. Only read operations performed on source code. | ✅ PASS |

**Result**: All gates pass. No constitution violations. Complexity tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/003-code-database-audit/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification with clarifications
├── research.md          # Phase 0 output — audit methodology and context
├── data-model.md        # Phase 1 output — existing entity/relationship map
├── quickstart.md        # Phase 1 output — audit run guide
├── contracts/           # Phase 1 output — deliverable format contracts
│   ├── code-inventory-format.md
│   ├── db-findings-format.md
│   └── reuse-extend-decision-format.md
├── findings/            # (Created by audit execution, not planning)
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

No source code changes — this feature produces documentation and analysis artifacts only. The existing project structure is examined but not modified:

```text
src/
├── modules/
│   ├── bookings/        # Inspected
│   ├── rooms/           # Inspected
│   ├── room-types/      # Inspected
│   ├── guests/          # Inspected
│   ├── contacts/        # Inspected
│   ├── pricing/         # Inspected
│   ├── accounting/      # Inspected
│   └── logs/            # Inspected
├── app/api/             # API routes inspected
└── config/              # permissions.ts, actionPermissions.ts inspected
```

**Structure Decision**: Single project with `specs/003-code-database-audit/` containing all planning artifacts. No new source directories created.

## Complexity Tracking

Not required — all constitution gates pass without violations.
