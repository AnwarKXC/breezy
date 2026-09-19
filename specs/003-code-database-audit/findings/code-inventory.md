# Code Inventory

Scope: reservation-related code areas in `src/modules`, `src/config`, and API routes. No production data was read.

## 1. Bookings

- Path: `src/modules/bookings/`
- Purpose: legacy booking read and client CRUD surface.
- Exported types/interfaces: `BookingStatus`, `Booking`, `BookingFilters`, `CreateBookingInput`, `UpdateBookingInput`, page/input helpers.
- Key functions: `getBookingsByGuest`, `getBookingsByContact`, `getBookingsByUser`; legacy hook methods `fetchBookings`, `createBooking`, `updateBooking`, `deleteBooking`.
- API surface: no `src/app/api/bookings/` directory found.
- Patterns: server-only service reads Supabase rows; older client hook imports root `@/services`.
- Limitations: status model is simple and single-booking oriented; no multi-room stay model, holds, per-room guest roles, lifecycle history, or deposit/company billing workflow.
- Reuse assessment: useful as legacy evidence only. Do not extend as canonical reservation model without major schema and API changes.

## 2. Rooms

- Path: `src/modules/rooms/`, `src/app/api/rooms/`
- Purpose: room catalog, state, and room details/history API surface.
- Exported types/interfaces: `RoomStatus`, `Room`, `CreateRoomInput`, `UpdateRoomInput`, `RoomsPage`, `RoomStatusHistoryEntry`, `RoomDetailsWithHistory`.
- Key functions/clients: `roomsApiClient` CRUD calls to `/api/rooms`; hooks `useRooms`, `useAdminRooms`.
- API surface: `/api/rooms`, `/api/rooms/[id]`, `/api/rooms/[id]/history`, `/api/rooms/[id]/details-with-history`.
- Patterns: API route handlers, Supabase-backed service/client split, soft delete conventions in newer areas.
- Limitations: app room status union is `available | occupied | maintenance | cleaning`, while reservation migrations introduce physical status semantics including dirty.
- Reuse assessment: extend. Rooms are the canonical room inventory and should be linked from `reservation_rooms`.

## 3. Room Types

- Path: `src/modules/room-types/`
- Purpose: room category/type catalog used by rooms and pricing.
- Exported types/interfaces: `RoomTypeRow`, `RoomType`, `CreateRoomTypeInput`, `UpdateRoomTypeInput`.
- Key functions/clients: `mapRoomTypeRow`, `toRoomTypeRow`, `roomTypeApiClient` CRUD, `useRoomTypes` hook.
- Patterns: typed mapping layer between database rows and UI models.
- Limitations: catalog only; no date-sensitive availability or reservation occupancy logic.
- Reuse assessment: extend as referenced lookup for rooms and pricing.

## 4. Guests

- Path: `src/modules/guests/`
- Purpose: guest profile management.
- Exported types/interfaces: `GuestStatus`, `Guest`, `GuestFilters`, `CreateGuestInput`, `UpdateGuestInput`.
- Key functions: legacy hook methods for list, search, create, update, delete.
- Patterns: UI hook backed by root service; type-only module exports.
- Limitations: guest profile does not model reservation membership, primary guest, sharer, payer, or per-room assignment. Module carries PII fields; audit did not read row data.
- Reuse assessment: extend. Keep `guests` as people/profile table and use `reservation_guests` for reservation participation.

## 5. Contacts

- Path: `src/modules/contacts/`
- Purpose: company and individual contact records, company price overrides, metrics, and contact logs.
- Exported types/interfaces: `ContactType`, `OccupancyCode`, `Contact`, `CompanyPriceOverride`, create/update inputs, page/metrics models.
- Key functions: `getContactsPage`, `getContactById`, `createContact`, `updateContact`, `deleteContact`, `getContactsMetrics`, `getLogsForContact`, `getPriceOverrides`, `upsertPriceOverrides`, `deletePriceOverride`.
- Patterns: server-only services; service-role writes; RLS-aware reads; soft deletion; domain logging.
- Limitations: contact records are reusable master data, not reservation-specific billing snapshots.
- Reuse assessment: extend. Link company contacts into reservations, but keep per-reservation billing terms in `reservation_company_info`.

## 6. Pricing

- Path: `src/modules/pricing/`
- Purpose: room type rate management.
- Exported types/interfaces: `RoomTypePricing`, `PricingRow`, `CreatePricingInput`, `UpdatePricingInput`.
- Key functions: `listPricing`, `getPricingByType`, `createPricing`, `updatePricing`, `deletePricing`, `mapPricingRow`.
- Patterns: typed service layer with settings permissions and soft delete fallback.
- Limitations: rate source only; not an immutable per-reservation price ledger.
- Reuse assessment: extend as calculation input. Store calculated nightly/override lines separately in `reservation_pricing_items`.

## 7. Accounting

- Path: `src/modules/accounting/`
- Purpose: invoices, invoice items, payments, expenses, ledger, reports, settings, exports.
- Exported types/interfaces: `Payment`, `Invoice`, `InvoiceItem`, `InvoiceEvent`, `LedgerEntry`, expense/category/report/settings models and lookup models.
- Key functions: payment CRUD/refund/delete, expense category and expense flows, invoice CRUD/issue/void/refund/delete, ledger/report/settings/export helpers.
- Patterns: broad service index, permission-aware writes, ledger/report read models.
- Limitations: existing payments are invoice/accounting centered. Reservation deposits and guarantees need clear synchronization to avoid duplicate financial state.
- Reuse assessment: integrate. Accounting remains source for invoice/ledger reporting; reservation payments need handoff/sync rules.

## 8. Logs

- Path: `src/modules/logs/`
- Purpose: audit/log browsing and analytics.
- Exported types/interfaces: `LogAction`, `LogModule`, `LogEntry`, `LogsFilters`, `LogsResponse`, `LogsAnalytics`.
- Key functions/clients: `fetchLogsPage`, `fetchLogsAnalytics`, `useLogs`.
- Patterns: cursor pagination and filterable analytics.
- Limitations: generic logs do not replace domain-specific reservation status chronology.
- Reuse assessment: extend for administrative audit visibility, but keep `reservation_status_history` for lifecycle history.

## 9. Permissions

- Paths: `src/config/permissions.ts`, `src/config/actionPermissions.ts`
- Purpose: role/module permissions and action-level permissions.
- Existing modules: users, accounting, reservations, contacts, logs, settings.
- Reservation actions present: confirm, cancel, check-in, check-out, price/deposit override, dirty/force assignment, record/refund payment, company credit.
- Role coverage: admin has all; front desk has core reservation actions; accountant has accounting-oriented access and should be reviewed for reservation payment/company credit actions.
- Limitations: permissions exist in config, but every route/service must consistently enforce them.
- Reuse assessment: extend. The action catalog is a good base for reservation workflow gating.

## 10. Reservations

- Path: `src/modules/reservations/`, `src/app/api/reservations/`
- Purpose: current canonical reservation model and workflow implementation.
- Exported types/interfaces: reservation statuses, booking type, source, billing party, room status, guest role, payment type/method, price source, `Reservation`, `ReservationRoom`, `ReservationGuest`, company/pricing/payment/hold/note/history models, availability models.
- Key functions: draft create/update, list/get, room add/remove, guest add, company info read, hold create/release, active holds, confirm, cancel, check-in, check-out, no-show, price override, payment record/read, notes/history read, availability and price recalculation.
- API surface: `/api/reservations`, `/api/reservations/availability`, `/api/reservations/[id]`, and action routes for confirm, cancel, check-in, check-out, no-show, override-price, payments, holds.
- Patterns: typed Supabase services, RPC-backed workflow transitions, explicit status transition helper.
- Limitations: depends on live migration/RLS deployment; accounting synchronization and legacy booking coexistence need operational guardrails.
- Reuse assessment: keep as canonical reservation implementation, while preserving legacy bookings only for migration/backward compatibility.
