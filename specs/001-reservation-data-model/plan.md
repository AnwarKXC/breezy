# Implementation Plan: Reservation Data Model

**Branch**: `001-reservation-data-model` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-reservation-data-model/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command.

## Summary

Build a safe, extensible hotel reservation data model supporting
individual, company, and group bookings, multi-room reservations,
room holds, availability checks, pricing overrides, payments, room
details/history, and audit logs by extending the existing `bookings`
table and creating new sub-tables for rooms, guests, pricing, holds,
notes, and status history. The system follows API-only writes and
reuses existing RBAC, audit, and accounting modules.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16 (App Router, RSC),
React 19

**Primary Dependencies**: Supabase (Auth, Database, Admin SDK),
Redux Toolkit 2, Zod 4, react-hot-toast, jsPDF

**Storage**: Supabase/Postgres — service-role client for server-only
operations, publishable key for browser clients

**Testing**: Vitest (unit/integration) + @testing-library/react +
@testing-library/jest-dom; Playwright (E2E)

**Target Platform**: Web — hotel front desk dashboard
(desktop + mobile responsive)

**Project Type**: Web application (Next.js full-stack)

**Performance Goals**: Room detail view within 2 seconds (SC-006);
availability search under 1 second for 100-room property

**Constraints**: API-only writes (no direct Supabase client writes);
all mutations require session + permission checks; audit logs for
all sensitive actions; bilingual (English + Arabic RTL)

**Scale/Scope**: Medium — 30-100 rooms, 50-200 reservations/day,
10-30 concurrent front desk users. No self-service guest portal.
No housekeeping workflow module.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gates

| Constitution Principle | Compliance Check | Status |
|------------------------|-----------------|--------|
| I. Database-First with Migrations | Every schema change MUST use numbered Supabase migrations. | ✅ Pass |
| I. Database-First with Migrations | Double booking MUST be prevented at database/service level, not frontend alone. | ✅ Pass (exclusion constraint or transactional RPC) |
| II. Strict Layered Architecture | UI → Hook → RTK → Service → Supabase/API flow enforced. | ✅ Pass |
| III. TypeScript Strictness & Validation | Zod validation for all inputs. No `as any`/`@ts-ignore`. | ✅ Pass |
| IV. Security, RBAC & Audit | Session + permission checks on every write. Audit logs for all sensitive actions. | ✅ Pass |
| IV. Security, RBAC & Audit | Business-critical mutations MUST use transactions/RPCs. | ✅ Pass |
| V. Code Quality & Performance | ESLint clean, build passes, i18n keys for all user-facing text. | ✅ Pass |

**Gate Result**: ✅ All constitutional gates pass. No violations
requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-reservation-data-model/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/api/reservations/       # Reservation API routes
│   ├── route.ts                # GET (list), POST (create)
│   ├── [id]/route.ts           # GET, PATCH, DELETE
│   ├── availability/route.ts   # GET (availability search)
│   ├── [id]/hold/route.ts      # POST (hold), DELETE (release)
│   ├── [id]/confirm/route.ts   # POST
│   ├── [id]/check-in/route.ts  # POST
│   ├── [id]/check-out/route.ts # POST
│   ├── [id]/cancel/route.ts    # POST
│   └── [id]/payments/route.ts  # GET, POST
├── app/api/rooms/
│   └── [id]/details-with-history/route.ts
├── services/
│   ├── reservationService.ts
│   └── reservationAvailabilityService.ts
├── modules/
│   └── reservations/
│       ├── types.ts
│       ├── constants.ts
│       ├── validation.ts
│       ├── hooks/
│       │   ├── useReservations.ts
│       │   └── useRoomAvailability.ts
│       ├── components/
│       │   ├── RoomAvailabilityBoard.tsx
│       │   ├── ReservationForm.tsx
│       │   ├── RoomDetailsModal.tsx
│       │   ├── ReservationStatusBadge.tsx
│       │   └── ...
│       └── index.ts
├── config/
│   └── permissions.ts          # Add reservation:* action permissions
└── i18n/locales/
    ├── en.json                 # Reservation translation keys
    └── ar.json                 # Arabic translations
```

**Structure Decision**: Web application with Next.js App Router.
New reservation module follows existing project patterns under
`src/modules/reservations/`, with API routes under
`src/app/api/reservations/` and services under `src/services/`.
Existing `src/services/bookingService.ts` will be extended rather
than replaced.

## Complexity Tracking

> Not needed — all constitutional gates pass without violations.
