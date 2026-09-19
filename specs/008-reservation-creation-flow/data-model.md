# Data Model: Reservation Creation and Hold Flow

**Feature**: 008-reservation-creation-flow | **Phase**: 1 — Design

## Overview

This phase introduces no new tables. Existing tables are used with potential column additions to `reservation_holds` (if `expires_at` or `created_by` are not yet present). All three RPCs operate on the existing reservation schema from Phase 2.

## Table: `reservations`

| Column | Type | Existing | Notes |
|--------|------|:--------:|-------|
| id | uuid | ✅ | Primary key |
| reservation_number | text | ✅ | Human-readable identifier |
| status | reservation_status | ✅ | Must support `draft`, `held`. CHECK constraint for valid transitions. |
| check_in_date | date | ✅ | |
| check_out_date | date | ✅ | |
| primary_guest_id | uuid | ✅ | FK to guests |
| company_id | uuid? | ✅ | Nullable FK |
| created_by | uuid | ✅ | FK to auth.users |
| created_at | timestamptz | ✅ | |
| updated_at | timestamptz | ✅ | |
| notes | text | ✅ | Optional operational notes |
| deleted_at | timestamptz | ✅ | Soft delete |

### Status Transitions (this phase)

```text
draft ──[confirm_reservation]──→ held
draft ──[cancel/manual]────────→ cancelled
```

- Only `draft` reservations can be confirmed
- Confirmation changes status to `held` (confirmed but guest not yet checked in)
- `held` → `checked_in`, `checked_in` → `checked_out` are covered by existing RPCs from earlier phases
- No direct path from `draft` → `cancelled` RPC in this phase (can be added later)

## Table: `reservation_rooms`

| Column | Type | Existing | Notes |
|--------|------|:--------:|-------|
| id | uuid | ✅ | Primary key |
| reservation_id | uuid | ✅ | FK to reservations |
| room_id | uuid | ✅ | FK to rooms |
| check_in_date | date | ✅ | Copied from reservation during confirmation |
| check_out_date | date | ✅ | Copied from reservation during confirmation |
| status | reservation_room_status | ✅ | Set to `held` on confirmation |
| adult_count | int | ✅ | |
| child_count | int | ✅ | |
| created_at | timestamptz | ✅ | |
| deleted_at | timestamptz | ✅ | Soft delete |

### Behavior

- Reservation_rooms are created from active holds during `confirm_reservation`
- Initial status is `held`
- Dates may differ from the parent reservation dates if per-room segments are supported (future enhancement; for now, room dates = reservation dates)

## Table: `reservation_holds`

| Column | Type | Existing | Notes |
|--------|------|:--------:|-------|
| id | uuid | ✅ | Primary key |
| reservation_id | uuid | ✅ | FK to reservations — NOT NULL (clarify decision) |
| room_id | uuid | ✅ | FK to rooms |
| check_in_date | date | ✅ | |
| check_out_date | date | ✅ | |
| status | text | ✅ | One of: `active`, `expired`, `released` — CHECK constraint enforced |
| expires_at | timestamptz | ? | Must exist or be added in this migration (hold expiry) |
| created_by | uuid | ? | Must exist or be added (reference to auth.users, the hold owner) |
| created_at | timestamptz | ✅ | |
| deleted_at | timestamptz | ✅ | Soft delete |

### Status Machine

```text
active ──[expiry]──→ expired
active ──[release]─→ released
```

- Only `active` holds block room availability
- `expired`: time-based transition via query filter (`expires_at <= now()`)
- `released`: manual transition by hold owner
- Once expired or released, a hold cannot be reactivated
- Lazy expiry: `status` updated to `expired` only when a query or RPC encounters an active hold with `expires_at <= now()`

### Uniqueness

- Uniqueness enforced at the RPC level (not a DB constraint): one active hold per (room_id, date_range) for different users. Same-user holds for the same room are allowed (user can hold a room across multiple drafts, though unusual).
- `FOR UPDATE NOWAIT` on active hold check prevents concurrent collisions.

## Table: `reservation_status_history`

| Column | Type | Existing | Notes |
|--------|------|:--------:|-------|
| id | uuid | ✅ | Primary key |
| reservation_id | uuid | ✅ | FK to reservations |
| status | reservation_status | ✅ | New status value |
| changed_by | uuid | ✅ | FK to auth.users |
| changed_at | timestamptz | ✅ | |

### New Entries (this phase)

- `draft` → entry written when draft is created (if not already written by prior creation flow)
- `draft` → `held` → entry written on successful confirmation
- `draft` → `cancelled` → entry written on cancellation (future RPC)

## Table: `audit_log`

| Column | Type | Existing | Notes |
|--------|------|:--------:|-------|
| id | uuid | ✅ | Primary key |
| action | text | ✅ | One of new action strings |
| entity_type | text | ✅ | `'reservation'`, `'reservation_hold'` |
| entity_id | uuid | ✅ | FK to affected entity |
| actor_id | uuid | ✅ | FK to auth.users |
| details | jsonb | ✅ | Structured context (room IDs, hold IDs, failure reasons) |
| created_at | timestamptz | ✅ | |

### New Audit Actions (this phase)

| Action | Trigger |
|--------|---------|
| `reservation.draft_created` | create_draft_reservation |
| `reservation_hold.created` | create_draft_reservation (per hold) |
| `reservation_hold.released` | release_hold |
| `reservation_hold.expired` | Automatic (lazy, when encountered by query or RPC) |
| `reservation.confirmed` | confirm_reservation |
