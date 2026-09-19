# Database Findings

Inspection source: checked-in Supabase migrations and generated `src/services/supabase/database.types.ts`. Supabase MCP was not exposed in this session and `supabase` CLI was not installed, so no live database rows or PII were queried.

## Existing Reservation-Relevant Tables

| Table | Role | Key columns and notes |
| --- | --- | --- |
| `bookings` | Legacy booking table | Guest/contact/room references and simple booking status. Suitable as legacy data, not the new multi-room reservation parent. |
| `rooms` | Room inventory | Room number/type/status and soft-delete style metadata. Referenced by reservation room assignments. |
| `room_types` | Room category lookup | Catalog for room inventory and base pricing. |
| `guests` | Guest profile master | PII-bearing guest profile fields; should be referenced, not duplicated. |
| `contacts` | Company/individual contact master | Company/individual contact data, soft delete, and contact logging. |
| `company_price_overrides` | Company rate override source | Company/contact-specific price overrides by room type/occupancy code. |
| `room_type_pricing` | Base pricing source | Base room pricing used as calculation input. |
| `payments` | Accounting payment records | Invoice/accounting-centered payments. Requires sync rules with reservation deposits/payments. |
| `invoices` / `invoice_items` | Accounting invoices | Final billing documents and line items. |
| `accounting_ledger_entries` | Financial ledger | Reporting/accounting ledger output. |
| `audit_logs` | Generic audit trail | Administrative audit events. Does not replace reservation lifecycle history. |
| `profiles` | User/role context | Used by RLS/permission checks and role decisions. |

## Reservation Model Tables

Migration `20260628000001_create_reservation_model.sql` introduces the canonical reservation tables:

| Table | Role | Key constraints/relationships |
| --- | --- | --- |
| `reservations` | Parent reservation | Status, booking type, source, billing party, guest/contact references, stay dates, totals, audit metadata. |
| `reservation_rooms` | Room-stay assignment | References reservation and room; date range per room; has exclusion constraint to block overlapping active room stays. |
| `reservation_guests` | Reservation guest membership | References reservation, guest, and optionally reservation room; supports roles such as primary/additional. |
| `reservation_company_info` | Reservation billing snapshot | References reservation and contact/company; stores per-reservation billing terms/company details. |
| `reservation_pricing_items` | Price ledger | References reservation and optional room/room type; records calculated and overridden price lines plus source. |
| `reservation_payments` | Reservation payment/deposit records | References reservation and optional accounting payment; supports deposits, guarantees, refunds. |
| `reservation_holds` | Temporary room holds | References reservation/room and expiration; supports hold release/expiry workflow. |
| `reservation_notes` | Reservation notes | Notes scoped to reservation and author metadata. |
| `reservation_status_history` | Domain lifecycle history | Tracks status changes, actor, reason, and timestamp. |
| `room_status_history` | Room physical/status history | Tracks room status transitions and actor metadata. |

## Enums And Types

Reservation migrations add enums for reservation status, booking type, billing party, source, reservation room status, guest role, payment type, payment method, price source, and room physical status. Generated TypeScript database types include these tables/enums, indicating schema typing has been captured in the repo.

## Relationships

- `reservation_rooms.reservation_id` -> `reservations.id`
- `reservation_rooms.room_id` -> `rooms.id`
- `reservation_guests.reservation_id` -> `reservations.id`
- `reservation_guests.guest_id` -> `guests.id`
- `reservation_company_info.contact_id` -> `contacts.id`
- `reservation_pricing_items.reservation_id` -> `reservations.id`
- `reservation_payments.reservation_id` -> `reservations.id`
- `reservation_payments.accounting_payment_id` can bridge to accounting payment records
- `reservation_holds.reservation_id` -> `reservations.id`
- `reservation_holds.room_id` -> `rooms.id`
- `reservation_status_history.reservation_id` -> `reservations.id`

## Constraints And Indexes

- `btree_gist` extension is used for the room overlap exclusion constraint.
- `reservation_rooms_no_overlap` prevents overlapping date ranges for active room statuses on the same room.
- Foreign keys keep reservation children attached to master tables and parent reservations.
- Reservation migrations add supporting indexes for reservation lookup, room/date availability, holds, and history access.

## RLS And Security Model

- Reservation migrations enable RLS on new reservation tables and add policies.
- Existing codebase uses a mix of RLS-aware reads and service-role writes in modules such as contacts and accounting.
- Route/service enforcement must align with `permissions.ts` and `actionPermissions.ts`, especially for overrides, force assignment, refunds, and company credit.
- Live policy verification still needs a connected Supabase environment because local CLI/MCP was unavailable here.

## Functions, RPCs, And Scheduled Work

Migration `20260628000001_create_reservation_model.sql` adds reservation workflow/availability functions including room availability and reservation confirmation behavior. Migration `20260628000002_reservation_rpcs.sql` adds check-in, check-out, and expired-hold release behavior, with pg_cron scheduling when the extension exists.

## API Route Inventory

- No `src/app/api/bookings/` route directory was found.
- Room routes exist at `/api/rooms`, `/api/rooms/[id]`, `/api/rooms/[id]/history`, `/api/rooms/[id]/details-with-history`.
- Reservation routes exist at `/api/reservations`, `/api/reservations/availability`, `/api/reservations/[id]`, plus action routes for confirm, cancel, check-in, check-out, no-show, override-price, payments, and hold release.
