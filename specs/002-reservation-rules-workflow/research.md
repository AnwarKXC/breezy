# Research: Existing Codebase Audit vs Non-Negotiable Rules

## Rule Coverage Map

| # | Rule | Status | Evidence |
|---|------|--------|----------|
| 1 | Use Supabase/Postgres as source of truth | ✅ Enforced | All services use `createServerSupabaseClient()` |
| 2 | Use Supabase MCP to inspect before migrations | ⚠️ Workflow rule | No automation — developer discipline only |
| 3 | Don't duplicate tables unless necessary | ✅ Clarified | Extend `bookings` (Q1), not create new `reservations` |
| 4 | Use migrations for every schema change | ✅ Enforced | `supabase/migrations/` exists with numbered files |
| 5 | Add indexes and constraints before building UI | ⚠️ Workflow rule | Migration files include indexes |
| 6 | Don't rely only on frontend validation | ✅ Enforced | All validations run server-side via Zod |
| 7 | Prevent double booking at DB/service level | ⚠️ Partial | Availability service exists but pricing returns 0. Exclusion constraint RPCs not yet confirmed in DB. |
| 8 | Keep reservation status separate from room physical status | ✅ Enforced | Separate `reservation_rooms.status` and `rooms.status` in types |
| 9 | Log all sensitive actions using existing audit system | ✅ Enforced | `auditService.ts` with `logReservationAction()` maps events to `log_action` enum |
| 10 | Use existing RBAC patterns | ⚠️ Partial | `BOOKINGS_READ` / `BOOKINGS_WRITE` exist. `RESERVATION_CANCEL` missing (bug). |
| 11 | Company bookings: company as payer, guests as sleepers | ✅ Enforced | `pricingService.ts` has `calculateRoomPrice()` with company override logic |
| 12 | Availability from reservations, room status, holds, maintenance | ⚠️ Partial | `availabilityService.ts` calls `get_room_availability` RPC. Pricing integration returns 0. |
| 13 | Manual price override requires permission and audit | ⚠️ Partial | `override_price` permission not yet added to `actionPermissions.ts` |
| 14 | Room holds must expire and stop blocking | ⚠️ Partial | `reservationService.ts` has `createHold`/`releaseHold`. Hold expiry cron not yet deployed. |

## Existing Database Findings

| Area | Status |
|------|--------|
| Existing booking table | `bookings` — legacy table with columns: check_in, check_out, guest_id, guest_name, room_id, room_number, status, paid_amount, total_amount |
| Existing room table | `rooms` — exists with room_status enum: available, occupied, maintenance, cleaning |
| Existing contact/company support | `contacts` table with company type support |
| Existing pricing support | `pricing` module exists, `pricingService.ts` with company override |
| Existing audit logs | `audit_logs` table with log_action enum: reservation_created, reservation_deleted, reservation_updated |
| Existing RLS | API-only write pattern — server routes use service role client |
| Tables to extend | `bookings` — add booking_type, source, billing_party, financial columns |
| Tables to create | `reservation_rooms`, `reservation_guests`, `reservation_company_info`, `reservation_pricing_items`, `reservation_payments`, `reservation_holds`, `reservation_notes`, `reservation_status_history`, `room_status_history` |
| Migrations needed | Migration for new sub-tables + RPCs + indexes |

## Existing Code Structure

| Layer | Path | Lines | Status |
|-------|------|-------|--------|
| Types | `src/modules/reservations/types.ts` | 399 | Complete |
| Constants | `src/modules/reservations/constants.ts` | 52 | Complete |
| Validation | `src/modules/reservations/validation.ts` | 98 | Complete |
| Reservation service | `src/modules/reservations/services/reservationService.ts` | 765 | Complete (23 functions) |
| Availability service | `src/modules/reservations/services/availabilityService.ts` | 116 | Partial (pricing = 0) |
| Pricing service | `src/modules/reservations/services/pricingService.ts` | 124 | Complete |
| Status service | `src/modules/reservations/services/statusService.ts` | 41 | Complete |
| Audit service | `src/modules/reservations/services/auditService.ts` | 60 | Complete |
| Client hooks | `src/modules/reservations/hooks/useReservations.ts` | 152 | Partial (missing confirm, hold, noShow) |
| Room availability hook | `src/modules/reservations/hooks/useRoomAvailability.ts` | 47 | Complete |
| API routes | `src/app/api/reservations/` | 10 files | Complete (all major endpoints) |
| Permissions | `src/config/actionPermissions.ts` | 97 | Partial (missing reservation:* actions) |

## Decisions

- **Decision**: Extend `bookings` as reservation parent (from clarification Q1)
- **Rationale**: Avoids duplicating existing foreign key relationships (invoices, payments, contacts). The existing partial implementation in `src/modules/reservations/` already assumes extension.
- **Alternatives**: Create new `reservations` table (rejected — would require bridge migration and risk breaking existing relationships)

- **Decision**: MCP inspection fallback is Supabase CLI or direct SQL (from clarification Q2)
- **Rationale**: Developers should never skip inspection — fallback tools provide equivalent visibility.

- **Decision**: No-show billing = first-night charge (from clarification Q3)
- **Rationale**: Hotel industry standard — compensates for holding the room while forgiving remaining nights.

## MCP Workflow Reference

### Inspection Checklist (from spec section 2.1)
- Existing tables, columns, enums, foreign keys, indexes, RLS policies, database functions/RPCs, migrations, seed data
- Priority areas: bookings, rooms, room_types, guests, contacts, companies, pricing, payments, profiles, roles/permissions, audit_logs

### Questions to Answer (from spec section 2.2)
- Does bookings table exist? → Yes (legacy, needs extension)
- Does bookings support company_id? → Not directly (contacts table has it)
- Does bookings support multiple rooms? → No (single room_id column)
- Does rooms include housekeeping_status? → Via room_status enum
- Does contacts support company and individual types? → Yes
- Does pricing support room type pricing? → Yes
- Does pricing support company-specific overrides? → Yes (pricingService.ts)
- Does audit_logs exist? → Yes
- Does RLS use auth.uid() or service role? → API-only service role

### Expected Output Format (from spec section 2.3)
```md
## Existing Database Findings
- Existing booking table: yes (legacy `bookings`, needs extension)
- Existing room table: yes (`rooms`)
- Existing contact/company support: yes (`contacts`)
- Existing pricing support: yes
- Existing audit logs: yes
- Tables to extend: bookings
- Tables to create: reservation_rooms, reservation_guests, ...
- Migrations needed: 1 migration for all new tables + RPCs + indexes
```
