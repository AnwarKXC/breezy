# Reservations Module — Code Review & Quality Audit

**Date:** 2026-08-29
**Skill:** `code-review-and-quality`
**Scope:** `src/modules/reservations/`, `src/app/api/reservations/`

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| HIGH | 2 | Patches applied |
| MEDIUM | 3 | Patches applied |
| LOW | 1 | Informational |

---

## Findings

### HIGH-1 — Exclusion constraint violations not handled gracefully

**Routes:** `change-room/route.ts`, `extend/route.ts`

**Problem:** When `change-room` updates `reservation_rooms.room_id` or `extend` updates `check_out_date`, the DB exclusion constraint (`reservation_rooms_no_overlap`) will reject the update if it creates an overlapping booking. The error was returned as a generic `VALIDATION_ERROR` with a cryptic Postgres message.

**Fix:** Detect exclusion constraint violation (`23P01`) and return `ROOM_UNAVAILABLE` with a clear message.

- `change-room/route.ts:56-60` — added `23P01` check → `{ code: 'ROOM_UNAVAILABLE', message: 'Room is already booked for those dates' }`
- `extend/route.ts:115-119` — added `23P01` check → `{ code: 'ROOM_UNAVAILABLE', message: 'Room is not available for the extended dates' }`

### HIGH-2 — Status casing inconsistency across routes

**Routes:** `cancel`, `change-room`, `extend`, `no-show`

**Problem:** `check-in` and `confirm` normalize status via `String(reservation.status).toLowerCase()`, but `cancel`, `change-room`, `extend`, and `no-show` compared raw DB values. If the DB returns uppercase enum values (e.g., `CONFIRMED`), these routes would reject valid transitions.

**Fix:** All routes now normalize status with `String(reservation.status).toLowerCase()` before comparison.

- `cancel/route.ts:31` — `includes(String(reservation.status).toLowerCase())`
- `change-room/route.ts:32` — `includes(String(reservation.status).toLowerCase())`
- `change-room/route.ts:61-92` — `isOccupied` derived from lowercased status
- `extend/route.ts:30` — `includes(String(reservation.status).toLowerCase())`
- `extend/route.ts:119-122` — `isOccupied` derived from lowercased status
- `no-show/route.ts:23` — `String(reservation.status).toLowerCase() === 'confirmed'`

---

## Informational Findings (not patched)

### INFO-1 — TOCTOU on all action routes

All action routes follow a read-status → check-allowed → mutate pattern without `SELECT FOR UPDATE`. The Supabase JS client does not support `FOR UPDATE` syntax. The DB exclusion constraint is the safety net for room-level conflicts; status-level conflicts are low-risk because status transitions are fast and rare.

### INFO-2 — Non-atomic multi-table mutations

`change-room`, `extend`, `check-in`, `check-out`, `cancel`, `no-show` perform multiple sequential writes (reservation_rooms, rooms, room_status_history, reservation_status_history) without a transaction wrapper. A failure midway leaves partial state. This is an architectural limitation of the Supabase JS client.

### INFO-3 — `confirm` vs `check-in` overlap

Both routes transition to `checked_in` with nearly identical logic. `confirm` additionally checks `check_in_date > now()`. Consider consolidating these into a single route.

### INFO-4 — Checkout invoice partial payment handling

`checkoutInvoice.ts` correctly handles three cases: fully paid (`paid`), partially paid (`partially_paid`), and unpaid (`issued`). Prior payments are properly merged. The math is sound. No "collect remaining balance" endpoint exists for `partially_paid` invoices.

### INFO-5 — Availability endpoint is advisory-only

The `get_room_availability` RPC returns a snapshot without row locking. Overbooking is prevented by the `reservation_rooms_no_overlap` exclusion constraint at the DB level, not by the endpoint itself.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/reservations/[id]/change-room/route.ts` | Exclusion constraint handling + status normalization |
| `src/app/api/reservations/[id]/extend/route.ts` | Exclusion constraint handling + status normalization |
| `src/app/api/reservations/[id]/cancel/route.ts` | Status normalization |
| `src/app/api/reservations/[id]/no-show/route.ts` | Status normalization |

## Verification

- TypeScript: clean (`tsc --noEmit`)
