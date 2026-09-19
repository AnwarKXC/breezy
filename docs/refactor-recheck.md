# Stabilization Refactor — Recheck Guide

Date: 2026-09-19. Scope: Prisma baseline cleanup and removal of the dead legacy data model.
Nothing here has been applied to the remote database yet. Apply the migration first
(`pnpm db:migrate`), then create an admin (`pnpm admin:create`), then walk through this list.

Legend: **DB** = database, **API** = server route/service, **UI** = screen/flow.

---

## 1. What changed

### Database (`prisma/migrations/20260919000000_baseline/migration.sql`)

| Change | Why |
|---|---|
| Dropped tables `bookings`, `booking_extra_charges` | Legacy model, 0 rows in production, nothing inserted into them any more. `reservations` is the only source of truth for stays. |
| Dropped table `reservation_payments` | 0 rows; its code was exported but never called. All money lives in `payments` (settlements against `invoices`). |
| Dropped table `deposit_policy_rules` | Only read by a function that was never called. |
| Dropped columns `invoices.booking_id`, `reservations.legacy_booking_id` | Legacy linkage. Invoices link to stays only through `invoices.reservation_id`. |
| Dropped 29 DB functions | Never called by the app, any trigger, or any column default. Three of them (`auto_checkin_reservations`, `auto_cancel_missed_checkin`, `auto_expire_held_reservations`) hardcoded user ids from the old project and would have failed. 12 live functions remain. |
| Dropped 4 duplicate indexes and the unused `room_physical_status` enum | Pure overhead. |
| Added 10 foreign-key indexes | Joins/cascades on e.g. `reservation_rooms.room_type_id`, `room_status_history.reservation_id`, `accounting_ledger_entries.invoice_id`. |
| Added CHECK `reservation_holds.status IN ('active','released','expired')` | Was free text. |
| Added CHECK on `reservation_status_history.from_status/to_status` (= reservation status values) | Was free text. |

### Server / UI

| Area | Change |
|---|---|
| Invoice services | `invoiceService.ts` (1,044 lines) was a stale copy of `accountingService.ts` that the API never used; fixes committed on 2026-09-09 landed only in the copy. Deleted it and `exportService.ts`; `accountingService.ts` is the single source. |
| `deleteInvoice` | Now matches what `DeleteInvoiceDialog` promises: blocked only when the linked reservation is **checked in**; otherwise the reservation is **cancelled** (status + history), holds released, rooms freed. Payments and ledger rows of the invoice are still removed. Previously it refused confirmed reservations and silently soft-deleted others. |
| `getInvoices?reservationId=` | Filtered `booking_id = <reservationId>` → never matched reservation invoices. Now filters `reservation_id` (UUID-validated, invalid id matches nothing). |
| Reservations list: "Invoice" / "Delete" actions | Looked up invoices with `?bookingId=<row id>` (never matched). Now `?reservationId=<reservation id>`. |
| Invoice detail (`getInvoiceById`) | Stay info (dates, rooms, guest) now comes from the linked reservation instead of the legacy booking. Feeds the summary line and PDF. |
| Invoice wizard "from booking" | Lookup list is built from reservations **that do not already have an active invoice**; the choice is saved as `reservation_id`. |
| Daily revenue report `occupancyCount` | Counted the empty legacy table (always 0). Now counts rooms in house on the report date from `reservation_rooms`. |
| Contact detail → Bookings | Only legacy rows were read for individual contacts (always empty). Now company contacts use `reservations.company_id`, individual contacts use `reservation_guests.contact_id`. API route and page loader share one implementation. |
| Extend stay conflict check | Mirrors the DB exclusion constraint: per-room dates, half-open `[in, out)`, statuses `held/reserved/occupied`, soft-deleted rows ignored. Before, a guest arriving on the new checkout day was a false conflict. |
| `POST /api/reservations/[id]/holds` | Read `result.ok` but the DB function returns `success` → every successful hold answered 409. Fixed. |
| Removed dead code | Legacy branches of `BookingsPage` (legacy form, check-in/out, cancel, delete, navigate-and-convert, extend/change-room handlers), `useBookingActions`, `useCheckoutHandler`, `useBookingFilters`, `BookingActionModals`, `BookingFormModal`, `useBookingForm`, `GuestInfoSection`, `GuestSearchSection`, `ChangeRoomDialog`, `useContactDetails`, `/api/bookings/[id]/extra-charges`, `src/services/dashboardService.ts`, reservation `paymentService`, unused `reservationService` hold/confirm methods (called RPCs that do not exist). |

---

## 2. Recheck checklist

Run with at least: 1 admin, 1 accountant, 1 front desk user, 2 room types with pricing,
5+ rooms, 1 company contact, 1 individual contact.

### 2.1 Reservations list (`/reservations`, legacy `BookingsPage`)
- [ ] **UI** List loads and shows every reservation (single and multi-room). A DB error now shows a toast instead of an empty list.
- [ ] **UI** Check-in, check-out (with extra charges + payment), cancel (with and without fee), delete, edit, open detail all go through `/api/reservations/...`.
- [ ] **UI→API** "Invoice" action downloads the invoice of **that** reservation (verify invoice number matches the reservation).
- [ ] **UI→API** "Delete" on a reservation that has an invoice opens the invoice-aware delete dialog for **that** invoice.
- [ ] **UI** Extend / change room are no longer offered in the table (they live on the reservation detail page).

### 2.2 Reservation detail (`/reservations/[id]`)
- [ ] **API** `GET /api/reservations/[id]` no longer returns a `payments` array (nothing read it). Page renders normally.
- [ ] **UI→API** Invoice panel finds the reservation's invoice (`?reservationId=`). Previously it could show "no invoice".
- [ ] **UI** Extend stay: extending into a date where another guest **arrives** that day is allowed; overlapping a stay is blocked; choosing an alternative room works.
- [ ] **DB** Try to force an overlapping stay (two tabs). The `reservation_rooms_no_overlap` exclusion constraint must reject the second one.
- [ ] **UI** Add extra charge and checkout modal still work (they use `reservation_pricing_items` / checkout API).

### 2.3 Invoices (Accounting → Invoices)
- [ ] **UI→API** Delete an invoice linked to a **draft/held/confirmed** reservation → invoice gone, reservation `cancelled`, rooms freed, entries in `reservation_status_history` and `room_status_history`.
- [ ] **UI→API** Delete an invoice linked to a **checked-in** reservation → blocked with the "check out the guest first" message, nothing changed.
- [ ] **UI→API** Delete an unlinked invoice with payments → invoice, payments and ledger rows removed.
- [ ] **UI** Invoice wizard "from booking": list shows only reservations without an active invoice; created invoice has `reservation_id` set (check invoice detail shows stay dates).
- [ ] **UI** Invoice PDF shows stay check-in/out for reservation invoices.
- [ ] **API** `GET /api/accounting/invoices?reservationId=not-a-uuid` returns an empty list (not all invoices).
- [ ] **API** Next invoice number (`/api/accounting/invoices/next-number`) returns `INV-<timestamp>`; uniqueness is enforced by `invoices_invoice_number_active_unique`.

### 2.4 Reports
- [ ] **API** Daily revenue report `occupancyCount` equals rooms in house that night (arrived ≤ date < departure, status occupied/checked out). Compare with the room grid for today and for a past date.

### 2.5 Contacts
- [ ] **UI** Company contact → Bookings tab lists its reservations (year/month filters work).
- [ ] **UI** Individual contact → Bookings tab lists reservations where the contact is a guest (was always empty).
- [ ] **UI** Renaming a contact still updates `reservation_company_info` and invoices guest name.

### 2.6 Holds
- [ ] **API** `POST /api/reservations/[id]/holds` returns 201 `{ holdId, roomId, expiresAt }` on success and 409 with the DB error code on conflict (`HOLD_CONFLICT`, `BOOKING_CONFLICT`, `ROOM_MAINTENANCE`).

### 2.7 Dashboard (module present but not mounted in the UI)
- [ ] **API** `GET /api/dashboard` counts active stays, today's arrivals/departures and revenue from `reservations` (was the empty legacy table). Only relevant if the dashboard page is wired back in.

### 2.8 Database sanity after `pnpm db:migrate`
- [ ] `pnpm db:status` shows the baseline applied.
- [ ] `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private') and p.prokind = 'f'` → 13 (+ extension functions from `btree_gist`, filter them if needed).
- [ ] Supabase advisors: no table in `public` without RLS; `anon`/`authenticated` have no grants.

---

## 3. Known issues found but NOT changed (need a decision or a later phase)

| # | Issue | Risk | Suggested fix |
|---|---|---|---|
| 1 | Browser code still queries Supabase directly (`createBrowserSupabaseClient`, ~14 files incl. `BookingsPage` room actions, `RoomDetailPage`, `reservationService`, `bookingService.getAll`). The new DB grants nothing to `anon`/`authenticated`. | **High** — these screens fail until their module moves to server routes + Prisma. | Convert per module (next phases). |
| 2 | Hardcoded "system user" id `e73d7512-…` used as `room_status_history.changed_by` in `BookingsPage`, `RoomDetailPage`, `src/shared/constants.ts`. That user does not exist in the new DB and the column has an FK to `profiles`. | **High** — those inserts fail. | Record the acting session user on the server when converting the rooms module. |
| 3 | Three base prices: `rooms.price`, `room_types.base_price`, `room_type_pricing.price*`. All are read (UI and `get_room_availability`). | Medium — prices can disagree. | Decide one authority in the pricing phase; trace `get_room_availability`, `create_reservation_with_rooms`, pricing screens first. |
| 4 | `get_room_availability` checks overlap with **reservation-level** dates, while the exclusion constraint uses **per-room** dates. | Medium — split stays can show wrong availability. | Rewrite the overlap subquery on `reservation_rooms.check_in_date/check_out_date` in the reservations phase. |
| 5 | `get_room_availability` reports `dirty` rooms as not `available`; the project rule says dirty/cleaning rooms can be reserved. Alternative-room pickers filter `status === 'available'`. | Low/Medium — fewer rooms offered than allowed. | Confirm the rule, then treat `dirty` as bookable in the pickers. |
| 6 | `room_status_history.from_status/to_status` mix room statuses and reservation-room statuses (`held`, `reserved`). | Low — history is free text. | Normalize writers, then add a CHECK. |
| 7 | `src/modules/reservations/services/*` (pricing/lifecycle/invoice integration) is imported only by its own tests. | Low — duplicate logic that can drift. | Keep the tested pure functions, delete the unused DB-access parts when converting reservations. |
| 8 | Invoice numbers are generated ad hoc in several places (`INV-<timestamp>`, `INV-<resno>-<suffix>`, `INV-CXL-…`). | Low — unique index prevents duplicates, but numbering is not sequential. | Add a DB sequence-based generator if sequential numbering is required. |
| 9 | Auto jobs (auto check-in, auto cancel missed check-in, auto expire held) never ran in production (no cron job). Their functions were removed. | Info | If wanted, implement as a scheduled Next route using the session-less system path. |
| 10 | CSRF cookie is only issued by `secureMutationEndpoint`; routes calling `validateCsrf(request)` without a response rely on the Origin check alone until a cookie exists. | Low | Issue the CSRF cookie on login / first page load. |
