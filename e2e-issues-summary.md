# E2E Issues Summary — Breezy System (2026-08-08)

Full details: `e2e-qa-report.md`

## Status: 9 ISSUES — ALL FIXED & VERIFIED (browser regression 2026-08-09)

Post-fix browser regression across all modules (login, reservations, contacts, users, accounting, logs, settings) passed with **zero console errors/warnings**. Each fix was re-verified in the live app:

- Contact create completes in seconds (no hang); list load errors now show a Retry button.
- Reservation delete from detail page redirects cleanly (no 406).
- Status column sort reorders rows correctly.
- Failed login shows error without unhandled rejection.
- Users page/delete produce no Redux or form-submission warnings.
- Currency displays correctly with/without FX rate.

**Booking-creation workflow test (2026-08-09)** — full create flow (guest/company search, inline contact creation, occupancy pricing, delete cleanup) exercised; 3 new high-severity bugs found and fixed:

- Deleted reservations no longer block rooms (`create_reservation_with_rooms` availability now excludes soft-deleted reservations; 5 orphaned room rows released).
- Reservation delete now releases `reservation_rooms` (status `released` + `deleted_at`) and `reservation_guests` — no more exclusion-constraint conflicts or phantom bookings.
- Occupancy pricing persists: `occupancy_code` now written by the RPC, so S/D/T rates survive `snapshotPricing` (Triple no longer silently downgraded to base rate).

## Critical / High
- ~~**Contact creation can hang indefinitely.**~~ **FIXED** — transient `ECONNRESET` during Supabase session check no longer maps to 401 (`authorizeRequest` now distinguishes 401 auth failures from 503 upstream errors, `src/shared/routeAuth.ts:16`); contacts list error state gained a Retry button; form recovers via `finally`.
- ~~**Deleted reservations permanently block room availability.**~~ **FIXED** — RPC availability subquery now includes `r.deleted_at is null`; migration `20260809000001_fix_create_reservation_ignore_deleted_reservations.sql`.
- ~~**Reservation delete orphans active `reservation_rooms`/`reservation_guests`.**~~ **FIXED** — DELETE route soft-deletes rooms (`status='released'`) and guests.
- ~~**Occupancy (S/D/T) pricing silently lost on create.**~~ **FIXED** — RPC persists `occupancy_code` on `reservation_rooms`; migration `fix_create_reservation_persist_occupancy_code`.

## Medium
- ~~**Deleting a reservation from its detail page shows a 406 error page**~~ **FIXED** — `ReservationDetailPage` redirects to the list via `onDeleted` instead of refetching the deleted row.
- ~~**Status column sorting in the reservations table is a no-op**~~ **FIXED** — rows carry a flat `status` field in both row builders.

## Low
- ~~Unhandled promise rejection (`auth/invalid_credentials`) on failed login~~ **FIXED** — login `handleSubmit` catches the rejected thunk.
- ~~Redux identity `createSelector` warning on Users page; "Form submission canceled" after user delete~~ **FIXED** — plain selectors; delete dialog no longer wraps actions in a form.
- ~~Currency display inconsistency between list (`$500/night`) and detail (`EGP/night`); new Standard room showed `$0/night`~~ **FIXED** — `formatCurrency` falls back to source currency symbol when conversion is unavailable (`$0/night` was data: no pricing set).
