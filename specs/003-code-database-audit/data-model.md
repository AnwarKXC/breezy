# Data Model: Existing Code and Database Audit

## Purpose

This document defines the entity and relationship map that the audit will discover, document, and evaluate. It serves as the template for the audit's database findings report and reuse/extend decisions.

The audit will check which of these entities exist, their current shape, and whether they can be extended to support the target reservation model.

## Existing Entities to Inspect

These are the entities (tables/modules) that the reference plan expects to find in the current codebase and database:

| Entity | Expected Location | Audit Questions |
|--------|-------------------|-----------------|
| bookings | Database table + `src/modules/bookings/` | Does it exist? Can it become the reservation parent? Does it support company_id, multiple rooms, status history? |
| rooms | Database table + `src/modules/rooms/` | Does it exist? Does it include housekeeping_status and operational_status? |
| room_types | Database table + `src/modules/room-types/` | Does it exist? How are pricing and capacity defined? |
| guests | Database table + `src/modules/guests/` | Does it exist? How are guest profiles structured? |
| contacts | Database table + `src/modules/contacts/` | Does it exist? Does it support both company and individual types? |
| pricing | Database table + `src/modules/pricing/` | Does it exist? Does it support room-type pricing? Company-specific overrides? |
| payments / invoices | Database tables + `src/modules/accounting/` | Does it exist? How are payments linked to bookings? |
| profiles / users | Database table | Does it exist? How are users authenticated and authorized? |
| roles / permissions | Database tables + `src/config/permissions.ts` + `src/config/actionPermissions.ts` | What actions exist? Can reservation-specific actions follow the same pattern? |
| audit_logs | Database table + `src/modules/logs/` | Does it exist? What events does it capture? |

## Target Reservation Entities (To Be Assessed for Reuse/Extend/Create)

These 9 entities from the reference plan (`docs/plans/reservation_model_supabase_mcp_plan.md` Section 3) will each receive a reuse/extend/create decision:

| Entity | Purpose | Possible Existing Match |
|--------|---------|----------------------|
| reservations | Parent reservation record | `bookings` table |
| reservation_rooms | Room assignments / stay segments | `booking_rooms` or similar |
| reservation_guests | Guests connected to the reservation | `booking_guests` or `guests` join table |
| reservation_company_info | Company billing and company-specific rules | Part of `bookings` or `contacts` |
| reservation_pricing_items | Explainable price lines | `pricing` or `price_overrides` table |
| reservation_payments | Deposits, payments, invoices, guarantees | `payments` table |
| reservation_holds | Temporary room locks | None expected |
| reservation_notes | Operational notes | `booking_notes` or similar |
| reservation_status_history | Lifecycle tracking | Part of `bookings` or `audit_logs` |

## Expected Relationships

The audit will verify these expected relationships:

```text
bookings / reservations
  ├── reservation_rooms (1-to-many)
  ├── reservation_guests (1-to-many)
  ├── reservation_company_info (1-to-1)
  ├── reservation_pricing_items (1-to-many)
  ├── reservation_payments (1-to-many)
  ├── reservation_holds (1-to-many)
  ├── reservation_notes (1-to-many)
  └── reservation_status_history (1-to-many)

rooms
  ├── room_types (many-to-1)
  └── reservation_rooms (1-to-many)

guests ── reservation_guests (many-to-many through join)

contacts/companies ── reservations (1-to-many)
```

## Status Models (Reference from Plan Section 3)

The audit will check whether these status systems exist in any form:

### Reservation Lifecycle Statuses
```
draft → held → confirmed → checked_in → checked_out
draft → cancelled
held → expired | cancelled
confirmed → cancelled | no_show
```

### Room Assignment Statuses
```
selected → held → reserved → occupied → checked_out
cancelled, released
```

### Physical Room Statuses
```
available | occupied | dirty | clean | inspected | maintenance
| out_of_order | blocked | reserved_future | due_out | due_in
```

### Billing Parties
```
guest | company | split | complimentary
```

### Booking Types
```
individual | company | group | travel_agent | internal
```

## Validation Rules (from Reference Plan Sections 13-14)

The audit will check whether these validation rules are enforced in the existing code:

- Check-in/out date ordering and night calculation
- Guest count minimums (adults + children > 0)
- Room capacity matching
- Pricing calculation priority
- Permission-based access control
- Status transition restrictions
