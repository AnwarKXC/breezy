# Implementation Plan: Room Click Details Modal & Final Acceptance

**Branch**: `016-room-details-modal` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-room-details-modal/spec.md`

## Summary

Build a room details modal that opens when a front desk user clicks any room card. The modal displays room status, current/future reservations, availability, and a history table combining events from reservations, housekeeping, and maintenance. Also verify that all 26 final acceptance criteria pass against the deployed reservation model.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Next.js 16 App Router, React 19

**Primary Dependencies**: Tailwind CSS v4, existing hooks/services from modules/reservations and modules/rooms

**Storage**: Supabase/Postgres — read-only data from existing tables

**Testing**: Vitest for unit tests (components, hooks), Playwright for E2E (click room → verify modal)

**Target Platform**: Web (desktop sidebar + mobile responsive per PWA requirements)

**Project Type**: Web application — Next.js components + API route + hooks + services

**Performance Goals**: Modal opens <1s, history table <2s for 500 events

**Constraints**: Read-only modal; single API call; supports RTL (Arabic) + LTR (English); reuses existing components/services

**Scale/Scope**: 1 API route, ~5 components, 1 hook, 1 service, E2E + unit tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate I — Database-First with Migrations
No new schema changes. Read-only queries against existing tables. **PASS**

### Gate II — Strict Layered Architecture
UI Component → Hook → Service → Supabase. Modal is a component, history fetches via dedicated hook and service. No direct DB access from UI. **PASS**

### Gate III — TypeScript Strictness & Validation
Zod validation for API payload parameters. Component props fully typed. **PASS**

### Gate IV — Security, RBAC & Audit
API route verifies session + permission before returning data. Modal only shows data the user is authorized to see. **PASS**

### Gate V — Code Quality & Performance
Single API call per modal open. History table paginates after 500 events. RTL/LTR layouts both render correctly. **PASS**

**Result**: ALL GATES PASS.

## Project Structure

### Documentation (this feature)

```text
specs/016-room-details-modal/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/api/rooms/
│   └── [id]/details-with-history/
│       └── route.ts                              # GET API route
├── modules/rooms/
│   ├── services/
│   │   └── roomDetailsService.ts                 # Combine room + reservation + history data
│   ├── hooks/
│   │   └── useRoomDetails.ts                     # React hook for fetching and caching
│   └── components/
│       ├── RoomDetailsModal.tsx                   # Modal shell + orchestration
│       ├── RoomDetailsHeader.tsx                  # Room number, type, floor, status
│       ├── RoomStatusCard.tsx                     # Physical/operational status
│       ├── CurrentReservationCard.tsx             # Active reservation summary
│       ├── NextReservationCard.tsx                # Future booking summary
│       ├── RoomAvailabilityCard.tsx               # Availability status
│       └── RoomHistoryTable.tsx                   # Chronological event table
├── modules/reservations/
│   └── types.ts                                  # Add RoomDetailsWithHistory type
└── e2e/
    └── room-details-modal.spec.ts                 # Playwright E2E tests
```

## Complexity Tracking

No constitution violations to justify.
