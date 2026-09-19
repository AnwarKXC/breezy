# Security Audit: Bookings Module

**Task:** 1.3 — Bookings Legacy Stabilization  
**Date:** 2026-08-29  
**Scope:** `src/modules/bookings/*`, `src/services/bookingService.ts`, `src/app/api/bookings/*`  
**Method:** Manual code review + agent-skills security-review checklist

---

## Executive Summary

The bookings module is a hybrid of legacy direct-Supabase client code and newer reservation-based flows with proper API auth. The legacy client-side code (`bookingService.ts`) operates without server-side RBAC — it relies on Supabase RLS for data isolation. The extra-charges API route was missing all security layers. **0 critical, 2 high, 2 medium, 1 low, 1 informational** finding.

---

## Findings

### HIGH-1: Extra-charges API missing auth, CSRF, and rate limiting

**File:** `src/app/api/bookings/[id]/extra-charges/route.ts`

Both GET and POST handlers use `createServerSupabaseClient()` directly without:
- `authorizeRoute` / `secureReadEndpoint` / `secureMutationEndpoint`
- `validateCsrf` (POST)
- `rateLimit`

Any authenticated user can read or create extra charges for any booking. This violates the RBAC pattern used by all other booking-adjacent API routes (e.g., `/api/reservations/[id]/check-out`).

**Fix:** Wrap GET with `secureReadEndpoint(request, ACTIONS.BOOKINGS_READ, ...)` and POST with `secureMutationEndpoint(request, ACTIONS.BOOKINGS_WRITE, ...)`.

### HIGH-2: `bookingService.ts` client-side service has no server-side authorization

**File:** `src/services/bookingService.ts`

`bookingService.create()`, `update()`, `delete()`, `extend()` use `createBrowserSupabaseClient()` and operate directly against Supabase. There is no server-side RBAC check — the service relies entirely on Supabase RLS. While RLS provides data isolation, it does not enforce business-logic authorization (e.g., "only front_desk can check-in guests").

The reservation-based flows correctly use server API routes with `secureMutationEndpoint`. Legacy bookings bypass this entirely.

**Note:** This is a known architectural debt (legacy vs. reservation systems). Full remediation requires migrating legacy bookings to the reservation API pattern. Documented as a migration target.

### MEDIUM-1: Legacy booking hard delete bypasses soft-delete pattern

**File:** `src/modules/bookings/hooks/useBookingActions.ts:459`

```typescript
await supabase.from('bookings').delete().eq('id', booking.id)
```

This performs a hard delete, while every other booking mutation uses soft-delete (`deleted_at` column). Hard deletes remove audit trails and cannot be recovered.

**Fix:** Use `bookingService.delete()` which performs soft-delete via `deleted_at` update.

### MEDIUM-2: `handleAction` catch block silently swallows errors

**File:** `src/modules/bookings/hooks/useBookingActions.ts:434-436`

```typescript
} catch (error) {
  console.error('[BookingsPage] Save failed:', error)
}
```

All errors from booking actions (check-in, check-out, cancel, delete, extend, change-room) are caught and only logged to console. No user-facing feedback is provided.

**Fix:** Add `toast.error('Action failed')` in the catch block.

### LOW-1: `useCheckoutHandler.ts` deletes extra charges via direct Supabase call

**File:** `src/modules/bookings/hooks/useCheckoutHandler.ts:183-186`

```typescript
await supabase.from('booking_extra_charges').delete().eq('booking_id', bookingId)
```

This bypasses the extra-charges API and any server-side validation. While the checkout flow itself is authenticated, the direct delete could be exploited if the checkout API is called with a manipulated `bookingId`.

**Note:** Low risk because the checkout flow is authenticated and the delete is scoped to the booking being checked out.

### INFO-1: `bookingService.ts` uses `Record<string, unknown>` extensively

**File:** `src/services/bookingService.ts`

`mapReservationToBooking` and related functions use untyped `Record<string, unknown>` casts. This is a type safety concern but not a security issue. The function correctly validates the data shape before use.

---

## Verification

- All reservation-based API routes use `secureMutationEndpoint` with proper RBAC
- Supabase RLS provides data isolation for legacy bookings
- `server-only` imports prevent client-side execution of server logic
- CSRF and rate limiting are consistently applied on mutation routes (except extra-charges)
