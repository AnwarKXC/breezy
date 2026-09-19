# Implementation Plan: Testing Plans for Reservation Model

**Branch**: `013-testing-plans` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-testing-plans/spec.md`

## Summary

Create a comprehensive test suite for the reservation model covering unit tests (core business logic in isolation), integration tests (service-layer with test database), and E2E scenarios (full-stack front desk workflows via API). Tests use factory functions for test data creation via existing service methods.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Next.js 16 App Router

**Primary Dependencies**: Vitest (test framework), Supabase Admin SDK (test DB access)

**Storage**: Supabase/Postgres test database with seeded reference data (rooms, room types, guests, companies)

**Testing**: Vitest for unit + integration tests; API endpoint calls for E2E scenarios

**Target Platform**: Development server (localhost)

**Project Type**: Web application — test suites in `tests/` directory

**Performance Goals**: Unit: <10s, Integration: <60s, E2E: <5min

**Constraints**: No shared state between tests; each test creates and cleans up its own data via factory functions; test DB must be isolated from production

**Scale/Scope**: ~7 unit test categories, ~6 integration test flows, ~8 E2E scenarios

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate I — Database-First with Migrations
Integration tests may require a migration or seed data setup. No production schema changes. **PASS** (with note: test seed data may need a lightweight migration)

### Gate II — Strict Layered Architecture
Tests follow the same architecture: tests call service methods (integration) or API endpoints (E2E). No UI component tests are included in scope. **PASS**

### Gate III — TypeScript Strictness & Validation
Test code must follow strict mode. No `as any` or `@ts-ignore` in tests. Test factories must validate inputs properly. **PASS**

### Gate IV — Security, RBAC & Audit
Integration tests verify permission checks and audit logging. E2E tests use authenticated sessions. **PASS**

### Gate V — Code Quality & Performance
Tests are excluded from production build. No console.log in test helpers. **PASS**

**Result**: ALL GATES PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/013-testing-plans/
├── plan.md              # This file
├── research.md          # Phase 0 — existing test patterns
├── data-model.md        # Phase 1 — test factories, test data shapes
├── quickstart.md        # Phase 1 — how to run the tests
├── contracts/           # Phase 1 — test interface contracts (moved to tasks.md)
└── tasks.md             # Created by /speckit.tasks
```

### Source Code (repository root)

```text
tests/
├── unit/
│   ├── reservations/
│   │   ├── date-overlap.test.ts
│   │   ├── status-transitions.test.ts
│   │   ├── nights-calculation.test.ts
│   │   ├── pricing-priority.test.ts
│   │   ├── company-billing.test.ts
│   │   ├── payment-balance.test.ts
│   │   └── permission-checks.test.ts
│   └── setup.ts                          # Vitest config + mocks
├── integration/
│   ├── reservations/
│   │   ├── create-reservation.test.ts
│   │   ├── hold-confirm-flow.test.ts
│   │   ├── double-booking.test.ts
│   │   ├── cancel-releases-room.test.ts
│   │   ├── check-in-out.test.ts
│   │   └── audit-log-price-override.test.ts
│   ├── factories/
│   │   └── reservation-factories.ts      # Factory functions for test data
│   └── helpers/
│       ├── test-db.ts                    # Test DB connection + cleanup
│       └── seed-data.ts                  # Reference data seeding
├── e2e/
│   ├── reservations/
│   │   ├── same-day-walk-in.test.ts
│   │   ├── future-reservation.test.ts
│   │   ├── due-out-dirty.test.ts
│   │   ├── maintenance-room.test.ts
│   │   ├── company-multi-room.test.ts
│   │   ├── split-stay.test.ts
│   │   ├── room-change.test.ts
│   │   └── stay-extension-conflict.test.ts
│   └── helpers/
│       ├── api-client.ts                 # Typed API client for E2E calls
│       └── test-auth.ts                  # Auth token helpers
├── vitest.config.ts                      # Vitest configuration
└── tsconfig.json                         # Test-specific TS config (extends root)
```

**Structure Decision**: Tests are organized by type (unit/integration/E2E) and then by module (reservations/). Factory functions, helpers, and seed data are shared across integration and E2E tests as appropriate.

## Complexity Tracking

No constitution violations to justify.
