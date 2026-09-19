# Rooms Module — Tests & Simplification Audit

**Date:** 2026-08-29
**Skill:** `test-driven-development` + `code-simplification`
**Scope:** `src/modules/rooms/`

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| HIGH | 1 | Patch applied |
| MEDIUM | 1 | Patch applied |
| LOW | 3 | Informational |

---

## Findings

### HIGH-1 — `dirty` status missing from validation schema

**File:** `src/shared/validation.ts:29`

**Problem:** `RoomCreateSchema` defined status as `z.enum(['available', 'occupied', 'maintenance', 'cleaning'])` — the `'dirty'` status was absent. This meant any API call setting `status: 'dirty'` would be rejected with a 400 error, even though `dirty` is a valid room status used by the reservation checkout flow and auto-clean RPC.

**Fix:** Added `'dirty'` to the enum: `z.enum(['available', 'occupied', 'maintenance', 'cleaning', 'dirty'])`.

### MEDIUM-1 — Dead `useAdminRooms` duplicate in `useRooms.ts`

**File:** `src/modules/rooms/hooks/useRooms.ts:119-157`

**Problem:** `useAdminRooms` was defined twice — once in `useRooms.ts` (without stale-request guard) and once in `useAdminRooms.ts` (with `useRef` generation counter for stale requests). The barrel export at `hooks/index.ts` re-exported from `useAdminRooms.ts`, making the `useRooms.ts` version dead code.

**Fix:** Removed the dead `useAdminRooms` function from `useRooms.ts` (39 lines removed).

---

## New Files

### `src/modules/rooms/services/roomLifecycle.ts`
Room status transition utility with:
- `canTransitionRoom(from, to)` — returns `true` if the transition is valid
- `getAllowedTransitions(status)` — returns the list of allowed next statuses

Valid transitions:
```
available → cleaning, maintenance
occupied  → dirty
maintenance → available
cleaning  → available
dirty     → available
```

### `src/modules/rooms/services/__tests__/roomLifecycle.test.ts`
30 tests covering all valid and invalid transitions.

---

## Informational Findings (not patched)

### INFO-1 — No state machine enforcement on API routes

The PATCH endpoint at `api/rooms/[id]/route.ts` accepts any valid status value without checking whether the transition is legal. The `roomLifecycle.ts` utility is now available for routes to use, but was not wired in to avoid behavioral changes.

### INFO-2 — `RoomDetailPage` bypasses API route

`RoomDetailPage.tsx` updates room status directly via Supabase client, bypassing the API route and its Zod validation. It also hardcodes a `changed_by` UUID. This is a pre-existing architectural issue.

### INFO-3 — `roomsSlice.ts` (Redux) is unused

The Redux slice at `store/roomsSlice.ts` duplicates CRUD operations but is never imported by the rooms module. It appears to be dead code from an earlier approach.

---

## Verification

- TypeScript: clean (`tsc --noEmit`)
- Tests: 30/30 passing (`vitest run src/modules/rooms`)
