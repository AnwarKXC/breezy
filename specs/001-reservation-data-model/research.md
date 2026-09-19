# Research: Reservation Data Model

## Existing Module Discovery

**Finding**: A partial reservation module already exists at
`src/modules/reservations/` and `src/app/api/reservations/`.

### Existing artifacts
- **Types**: `Reservation`, `ReservationRoom`, `ReservationGuest`,
  `ReservationCompanyInfo`, `ReservationPricingItem`, `ReservationPayment`,
  `ReservationHold`, `ReservationNote`, `ReservationStatusHistory` +
  input DTOs + status transition map — all in `src/modules/reservations/types.ts`
- **Service**: `createReservationDraft`, `confirmReservation`,
  `listReservations`, `checkInReservation`, `recordPayment` — in
  `src/modules/reservations/services/reservationService.ts`
- **Validation**: `validateCreateReservation`, `validateConfirmReservation`,
  `validatePaymentAmount`, `validateStatusTransition` — in
  `src/modules/reservations/validation.ts`
- **Constants**: Module name, event names, hold duration, page limits —
  in `src/modules/reservations/constants.ts`
- **Audit**: `logReservationAction` with action-to-enum mapping —
  in `src/modules/reservations/services/auditService.ts`
- **Barrels**: `src/modules/reservations/services/index.ts` and
  `src/modules/reservations/index.ts`
- **API routes**: `GET/POST` on `/api/reservations`, `GET/PATCH/DELETE`
  on `/api/reservations/[id]`, action sub-routes for confirm, check-in,
  check-out, cancel, payments
- **Permissions**: `ACTIONS.BOOKINGS_READ` / `ACTIONS.BOOKINGS_WRITE`
  in `src/config/actionPermissions.ts`
- **DB types**: `booking_status` enum, `log_action` enum, `reservations`
  table in `src/services/supabase/database.types.ts`

### What may be missing or needs verification
- `getRoomAvailability` / availability service
- Room details & history endpoints
- Migration files for new sub-tables (`reservation_rooms`,
  `reservation_guests`, `reservation_company_info`,
  `reservation_pricing_items`, `reservation_payments`,
  `reservation_holds`, `reservation_notes`, `reservation_status_history`)
- RLS policies for new tables
- Frontend components (RoomAvailabilityBoard, ReservationForm,
  RoomDetailsModal, etc.)
- Hooks (`useReservations`, `useRoomAvailability`)
- i18n translation keys
- E2E tests

## Decision: Extend vs Rebuild
- **Decision**: Extend existing static types/partial module with
  complete implementation
- **Rationale**: The types, validation, and service stubs already
  follow project conventions exactly. Rewriting would duplicate effort
  and risk inconsistency with existing patterns.
- **Alternatives**: Clean rewrite (rejected — would lose existing
  integration with RBAC, audit, and API route patterns)

## Decision: Table Strategy
- **Decision**: Use existing `bookings` table as reservation parent;
  create `reservation_rooms`, `reservation_guests`,
  `reservation_company_info`, `reservation_pricing_items`,
  `reservation_payments`, `reservation_holds`, `reservation_notes`,
  `reservation_status_history` as new sub-tables
- **Rationale**: Avoids data migration, maintains existing foreign key
  relationships (invoices, payments, contacts), and keeps backward
  compatibility with existing UI components
- **Alternatives**: Create new `reservations` table (rejected — would
  break existing invoice/payment/contact relationships)

## Decision: Architecture Pattern
- **Decision**: API-only writes via `secureMutationEndpoint` +
  `secureReadEndpoint` wrappers; server-only services with
  `createServerSupabaseClient`
- **Rationale**: Matches existing contact module pattern; provides
  consistent auth, CSRF, rate limiting, and audit logging
- **Alternatives**: Direct Supabase client writes (rejected — less
  secure, harder to audit per constitution Principle IV)

## Decision: Concurrency & Conflict Prevention
- **Decision**: Postgres exclusion constraint
  (`reservation_rooms_no_overlap` using `btree_gist`) for double
  booking prevention; transactional RPC for reservation confirmation
- **Rationale**: Database-level enforcement regardless of application
  layer; matches constitution Principle I
- **Alternatives**: Application-level locking only (rejected —
  vulnerable to race conditions under 30 concurrent users)

## Decision: Reservation Numbering
- **Decision**: Sequential prefixed format `RSV-{sequential_id}`
- **Rationale**: Human-readable, sortable, hotel industry standard
- **Alternatives**: UUID (rejected — not human-friendly for front desk
  staff), date-based (rejected — longer, harder to remember)

## Existing API Route Patterns (from contacts module)
- `secureReadEndpoint(request, action, handler)` — GET routes
- `secureMutationEndpoint(request, action, handler)` — POST/PATCH/DELETE
- Context: `{ params }: { params: Promise<{ id: string }> }`
- Rate limit tiers: `AUTH` (5/min), `MUTATION` (30/min),
  `READ` (100/min), `ANALYTICS` (20/min)

## Existing Permission Patterns
- `ACTIONS.BOOKINGS_READ = 'bookings:read'`
- `ACTIONS.BOOKINGS_WRITE = 'bookings:write'`
- Mapped to `ROLE_PERMISSIONS[ROLES.FRONT_DESK]` and `ROLES.ADMIN`
- Need to add: `RESERVATION_CONFIRM`, `RESERVATION_CANCEL`,
  `RESERVATION_CHECK_IN`, `RESERVATION_CHECK_OUT`,
  `RESERVATION_OVERRIDE_PRICE`, `RESERVATION_RECORD_PAYMENT`

## Testing Strategy
- **Unit**: Vitest — status transition validation, price priority
  resolution, date overlap detection, validation logic
- **Integration**: Vitest with Supabase test helpers — reservation
  CRUD, hold expiry, double booking prevention, check-in/out flow
- **E2E**: Playwright — walk-in booking, company multi-room booking,
  room availability search, room details modal

## i18n Keys Needed
- Reservation status labels (draft, held, confirmed, checked_in, etc.)
- Room availability status labels
- Room history table column headers and event type labels
- Form labels (booking type, billing party, pricing sources, etc.)
- Toast/error messages
- Room details modal sections and labels
