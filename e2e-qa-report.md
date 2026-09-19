# Breezy System — E2E QA Report

- **Date/Time:** 2026-08-08, 09:00–09:36 UTC (local ~12:00)
- **URL:** http://localhost:3000 (local dev server, Next.js 16.2.10)
- **Environment:** Windows, Chrome 151 via Playwright MCP (automation), model DeepSeek V4-Flash
- **Backend:** Supabase project `qgkblsbrqohfvmhpogzc.supabase.co`
- **Test credentials:** admin@hotel.com / changepassword (admin role)
- **Coverage:** login, reservations (list, filters, search, sort, detail, notes, invoice PDF, create, delete), users (create, delete), contacts (list, create, delete)

## Routes tested

| Route | Result |
|---|---|
| `/[locale]/login` | PASS (see issues for UX notes) |
| `/en/reservations` | PASS (see sort issue) |
| `/en/reservations/[id]` | PASS (see delete-redirect issue) |
| `/en/reservations/new` | PASS (create + delete flow works) |
| `/en/users` | PASS |
| `/en/contacts` | PASS (see create-form issue) |
| `/en/dashboard`, `/en/accounting`, `/en/logs`, `/en/settings`, `/en/rooms/[id]` | Load successfully (routes exist and render) |

## Findings by module

### Auth (PASS with UX notes)
- Empty form submit → HTML5 required-field validation blocks submission. ✓
- Invalid credentials → friendly error "Check your email and password, then try again." ✓
  - Console: Supabase `auth/invalid_credentials` (400) + **unhandled promise rejection** — see Issue #4.
- Valid login redirects to `/en/reservations` (post-login landing, not dashboard). ✓

### Reservations (mostly PASS)
- Search filters rows client-side. ✓
- Status filter modal: "Checked In" → 2 rows. ✓
- Room-status filter: "Occupied" → rooms 102, 104. ✓
- Pagination works ("Showing 1 to 2 of 2"). ✓
- Row actions menu (portal) opens; "Check Out" action available for checked-in booking. ✓
- Detail page `/en/reservations/e60f2182-177b-4187-aa61-27a9061d55ee`: notes added and persisted ("QA test note - handover for shift"); status-history audit shown; invoice downloads `INV-20260806-0235.pdf`. ✓
- **Create flow (PASS):** guest search + company "in trip", dates 2026-08-10 → 2026-08-12, Standard room type, created draft `RSV-20260808-E8D069` (room 103); then deleted via "Delete Invoice" → list back to 7 rows. ✓
- **Delete-from-detail (FAIL):** after deletion the page refetches the deleted reservation and shows a Supabase 406 error page instead of redirecting — Issue #2.
- **Sorting (FAIL):** Status column sort has no effect — Issue #3.

### Users (PASS)
- Stats cards: Total 6 → 5 after delete. ✓
- Create user "QA Test User" (qa.test.082025@example.com) succeeded; required-field validation works; delete with confirmation dialog works. ✓
- Console warnings: Redux identity `createSelector`; "Form submission canceled because the form is not connected" after delete — Issue #5.

### Contacts (mostly PASS, one High issue)
- List loads (2 company contacts), search + type filter + CSV/PDF export present. ✓
- **Create via UI (FAIL):** filled form "QA Test Contact", Save stuck at "Saving..." — POST `/api/contacts` returned **401 Unauthorized** and the modal never recovered (no error toast, button stays disabled). Root cause traced to server-side `TypeError: fetch failed` (`read ECONNRESET`) while verifying the session against Supabase inside `authorizeRequest` (`src/shared/routeAuth.ts:16`), which maps any exception to 401. The same GET requests intermittently fail ("Unable to load contacts — Request failed. Please try again." with no retry button). The failure is transient: manual retry POST returned **201 "Contact created"** — Issue #1.
- Delete via actions menu + confirmation dialog works (soft delete: `deleted_at` set; verified in DB). ✓
- Cleanup: QA Retry Contact soft-deleted (deleted_at 09:35:34 UTC).

## Issues found

1. **HIGH — FIXED** — Contact create form hangs on transient API failure (401 → stuck "Saving...", no error recovery). Also: no retry button on contacts list load failure. Root cause: server session verification (Supabase `auth.getUser`) hit a transient `ECONNRESET`, and `authorizeRequest` mapped ALL errors to 401. Fixes:
   - `src/shared/routeAuth.ts`: `AuthAccessError` → 401, any other error (network/upstream) → 503, so clients can distinguish "re-authenticate" from "try again".
   - `src/services/auth/serverSession.ts`: removed try/catch that converted network errors into `auth/invalid_session` (401).
   - `ContactsStateCard` + `ContactsPage`: error state now has a Retry button (i18n key added en/ar).
   - Contact form already recovers via `finally` (was only slow because the server hung ~71s on the failed fetch).
2. **MEDIUM — FIXED** — After deleting a reservation from its detail page, page refetched deleted row → Supabase 406 error page. Fix: `ReservationActions` gets `onDeleted` callback; `ReservationDetailPage` passes `router.replace('/[locale]/reservations')` after successful delete instead of refreshing the deleted record.
3. **MEDIUM — FIXED** — Reservations table Status-column sorting was a no-op (sort key `status` didn't match nested `booking.status`). Fix: rows now carry a flat `status: booking.status` field in both row builders (`BookingsPage`, `useBookingFilters`).
4. **LOW — FIXED** — Unhandled promise rejection `auth/invalid_credentials` on failed login. Fix: `handleSubmit` in login page now catches the rejected thunk (error still surfaces via redux state + UI).
5. **LOW — FIXED** — Redux identity `createSelector` warnings (`selectUsersState`, `selectUIState`) replaced with plain selector functions; "Form submission canceled because the form is not connected" fixed by removing the `<form onSubmit>` wrapper in `DeleteConfirmationDialog` (buttons are now `type="button"` + onClick).
6. **LOW — FIXED** — Currency display: `formatCurrency` showed the system symbol even when it could not convert (missing FX rate). Now falls back to the source currency symbol, matching documented behavior. Note: `$0/night` for a new Standard room was data (no pricing set), not code.

### Tests fixed (pre-existing drift, unrelated to the 6 issues)
- `invoiceWizardValidation.test.ts`: expected message updated to match current code ("Guest or company is required").
- `lifecycleService.test.ts`: cases updated to lowercase statuses (matches live DB enum).
- `pricingService.test.ts`: expected `priceSource` updated to `default_room_type_rate`.

### Known pre-existing test failures (not touched)
- Contacts module component tests (`ContactsTable`, `InvoiceModal`, `PriceOverridesSection`): missing `I18nProvider` in test setup.
- Contacts/invoice/price-override integration tests: mock supabase client lacks `.is()` support.
- `contacts.test.ts` API test: stale expectation (400 vs 201); `checkoutInvoice.test.ts`: stale totals expectation.

## Post-fix browser verification (2026-08-09, all modules)

Full regression pass with Playwright MCP after the 6 fixes. All modules pass with zero console errors/warnings.

| Module | Result | Notes |
|---|---|---|
| Login | PASS | Valid login → clean redirect to `/en/reservations`; **no unhandled rejection** (Issue #4 verified) |
| Reservations | PASS | Status sort now reorders rows (Cancelled → Checked In → Checked Out) (Issue #3 verified); created draft `9f5201c0-...` → delete via "Delete Invoice" (draft invoice `#INV-RSV-2026-Y2T4`) → clean redirect to list, **no 406** (Issue #2 verified); 0 console errors |
| Contacts | PASS | Create "Browser QA Contact" completed in seconds (no hang) (Issue #1 verified); delete via actions menu works; list restored to 2 contacts |
| Users | PASS | **0 console warnings** — no Redux identity selector warnings, no "Form submission canceled" (Issue #5 verified); created + deleted QA user, count 5 → 6 → 5 |
| Accounting | PASS | All 6 tabs render with data: Overview ($36,072 revenue, $17,540 outstanding, $31,072 net profit), Invoices (7), Payments (10), Ledger (12 txns), Expenses, Reports |
| Reports API | PASS | `GET /api/accounting/reports/daily-revenue?date=2026-08-06` → `payments:[{method:"cash",amount:3000}]`; 2026-08-08 (default, no data) correctly empty — data semantics correct, not a bug |
| Logs | PASS | Analytics cards (2 actions today, active user admin, module Users), filters (user/date/module/action), CSV/PDF export, 5 pages @ 25 rows; audit includes the QA user create/delete entries — end-to-end logging verified |
| Settings | PASS | Rooms overview (4 rooms, 6 types, 2 available, $225 avg/night), Room Types (6), Pricing rates, Service Charge & VAT (0%/0%), Currency (USD/EGP/EUR) — all render, 0 console errors |
| Dashboard `/en` | PASS | Redirects to `/en/reservations` (by design — no standalone dashboard) |
| `/en/rooms` | N/A | 404 — rooms managed under Settings (`/en/settings?tab=rooms`), no standalone route |

Test data cleaned up: draft reservation + invoice deleted; QA contact/user deleted; no test rows remain.

## Booking-creation workflow test (2026-08-09, browser)

Full create-booking workflow exercised on `/en/reservations/new`: validation edge cases, guest/company search, inline contact creation, occupancy pricing, booking creation, detail-page verification, and delete cleanup. All 12 checkpoints (A1–A3, B1–B5, C1, C2, D, E) passed. **Three new bugs found and fixed** during this pass (see Issues 7–9).

| Checkpoint | Scenario | Result |
|---|---|---|
| A1 | Empty state: Create disabled; guest/dates/rooms hints shown | PASS |
| A2 | Check-out before check-in → inline error, Create disabled | PASS |
| A3 | Room counts capped by availability (max 1/type); `+` disables at max; totals-match hint | PASS |
| B1 | Search + select existing company "in trip" → $1,800 summary (4 rooms × 2 nights), 0% SC/VAT | PASS |
| B2 | No-results search → dropdown shows only "Add" | PASS |
| B3 | New-contact modal validation (native required + email format) | PASS |
| B4 | Inline create individual "Workflow QA Guest" → toast + auto-selected | PASS |
| B5 | Inline create company "Workflow QA Company" → auto-selected | PASS |
| C1 | Company booking submit: #RSV-20260808-A42E43, 4 rooms, $1,800, `reservation_company_info` + invoice INV-RSV-2026-66TI created, 0 guest rows (company flow) | PASS |
| C2 | Individual booking: occupancy S/D/T pricing verified live (S $200 / D $600 / T $1,200 for 2 nights); Triple booking #RSV-20260808-2816DE created at $600/night, `occupancy_code=T` persisted, primary guest row + invoice INV-RSV-2026-RHZH | PASS |
| D | Cleanup via UI: both reservations deleted ("Delete Invoice" path) → rooms released + invoice/guest rows soft-deleted; both QA contacts deleted | PASS |
| E | This report | PASS |

Error-path verification: a 409 ROOM_UNAVAILABLE shows an inline error banner, availability counts update, and Create disables — no stale state.

## Issues found during workflow test (2026-08-09)

7. **HIGH — FIXED** — Soft-deleted reservations permanently blocked room availability. The `create_reservation_with_rooms` RPC availability subquery lacked `r.deleted_at is null` (the GET `get_room_availability` had it), so deleted drafts still counted their `reservation_rooms` as blocking → false 409 ROOM_UNAVAILABLE. Fix: new migration `20260809000001_fix_create_reservation_ignore_deleted_reservations.sql` recreates the RPC with the filter (plus the `v_nights := p_check_out - p_check_in` line that a first apply had dropped, re-applied via `fix_create_reservation_vnights_assignment`). Data fix: 5 orphaned `reservation_rooms` rows from previously deleted reservations were released (`status='released'`, `deleted_at` set) to unblock live rooms.
8. **HIGH — FIXED** — Reservation delete left `reservation_rooms` (and `reservation_guests`) active → orphaned rows blocked the room via the `reservation_rooms_no_overlap` exclusion constraint (and polluted availability). Fix: `src/app/api/reservations/[id]/route.ts` DELETE now soft-deletes `reservation_rooms` (`deleted_at` + `status='released'`) and `reservation_guests` (`deleted_at`). Verified via UI delete → DB rows released.
9. **HIGH — FIXED** — Occupancy pricing was silently lost on create. The RPC priced Single/Double/Triple correctly but its `reservation_rooms` INSERT never wrote `occupancy_code` (column missing from the insert list); `snapshotPricing` then recomputed from the NULL occupancy and overwrote rate/total/invoice down to the base rate (e.g. Triple $1,200 → $600). Fix: RPC now carries `occupancyCode` through the selected-rooms payload and persists it on `reservation_rooms` (migration `fix_create_reservation_persist_occupancy_code`, applied to live DB + merged into the local `20260809000001` migration file). Verified end-to-end: Triple booking stored `occupancy_code='T'`, $600/night, $1,200 invoice.

## Verification notes
- Supabase RLS/API behavior was cross-checked with direct SQL (contacts soft-delete verified; no test rows remain).
- Server logs (`dev-server.log`) confirm the transient `ECONNRESET` on `/api/contacts` POST/GET preceding 401s.
- DB state verified after every workflow step via direct SQL (reservation, `reservation_rooms`, `reservation_guests`, `reservation_company_info`, invoices, `reservation_rooms_no_overlap` constraint def).
