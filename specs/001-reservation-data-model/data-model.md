# Data Model: Reservation

## Status: Extension of Existing Schema

The reservation model extends the existing `bookings` table and
creates 9 new sub-tables. All existing tables (rooms, room_types,
contacts, guests, pricing, profiles) remain unchanged.

---

## Entity: Reservation (extends `bookings` table)

The existing `bookings` table is extended to serve as the
reservation parent.

### New/Extended Columns

| Column | Type | Notes |
|--------|------|-------|
| `booking_type` | text | `individual`, `company`, `group`, `travel_agent`, `internal` |
| `source` | text | `walk_in`, `phone`, `website`, `whatsapp`, `email`, `company`, `travel_agent`, `ota`, `manual` |
| `billing_party` | text | `guest`, `company`, `split`, `complimentary` |
| `currency` | text | Default: `USD` |
| `subtotal_amount` | numeric(12,2) | |
| `discount_amount` | numeric(12,2) | |
| `tax_amount` | numeric(12,2) | |
| `service_amount` | numeric(12,2) | |
| `total_amount` | numeric(12,2) | |
| `paid_amount` | numeric(12,2) | |
| `balance_amount` | numeric(12,2) | |
| `guarantee_type` | text | `none`, `credit_card`, `deposit`, `company_guarantee` |
| `special_requests` | text | |
| `internal_notes` | text | |
| `updated_by` | uuid | References profiles(id) |
| `cancelled_at` | timestamptz | |
| `checked_in_at` | timestamptz | |
| `checked_out_at` | timestamptz | |

### Existing Columns (unchanged)

`id`, `guest_id`, `guest_name`, `room_id`, `room_number`,
`check_in`, `check_out`, `status` (extended with reservation
statuses), `adults`, `children`, `created_by`, `created_at`,
`updated_at`, `deleted_at`

### Status Constraint

Extended to support: `draft`, `held`, `confirmed`, `checked_in`,
`checked_out`, `cancelled`, `no_show`, `expired`

### Business Constraints

```
check (check_out_date > check_in_date)
check (nights > 0)
check (room_count > 0)
check (adults >= 0 and children >= 0 and infants >= 0)
check ((adults + children) > 0)
check (total_amount >= 0)
check (paid_amount >= 0)
```

### Status Transition Map

```
draft → held, confirmed, cancelled
held → confirmed, expired, cancelled
confirmed → checked_in, cancelled, no_show
checked_in → checked_out
checked_out → (terminal)
cancelled → (terminal)
no_show → (terminal)
expired → (terminal)
```

---

## Entity: ReservationRoom

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| reservation_id | uuid | FK → bookings(id), on delete cascade |
| room_id | uuid | FK → rooms(id) |
| room_type_id | uuid | FK → room_types(id) |
| stay_segment_type | text | `full_stay`, `split_stay`, `room_move` |
| check_in_date | date | |
| check_out_date | date | |
| status | text | `selected`, `held`, `reserved`, `occupied`, `checked_out`, `cancelled`, `released` |
| adults | integer | Default: 1 |
| children | integer | Default: 0 |
| infants | integer | Default: 0 |
| assigned_guest_id | uuid | FK → guests(id) |
| rate_per_night | numeric(12,2) | |
| nights | integer | |
| subtotal_amount | numeric(12,2) | |
| discount_amount | numeric(12,2) | |
| tax_amount | numeric(12,2) | |
| total_amount | numeric(12,2) | |
| price_source | text | `default_room_type_rate`, `room_specific_rate`, `company_override`, `seasonal_rate`, `manual_override` |
| housekeeping_requirement | text | `clean_required`, `no_cleaning`, `deep_clean` |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz | |

### Constraints

- Exclusion constraint on `room_id` with `daterange(check_in_date, check_out_date, '[)')` for active statuses (`held`, `reserved`, `occupied`) — prevents double booking at DB level
- `check (check_out_date > check_in_date)`

---

## Entity: ReservationGuest

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| reservation_id | uuid | FK → bookings(id), on delete cascade |
| guest_id | uuid | FK → guests(id), nullable |
| role | text | `primary_guest`, `additional_guest`, `company_employee` |
| full_name | text | |
| phone | text | |
| email | text | |
| nationality | text | |
| document_type | text | |
| document_number | text | |
| assigned_room_id | uuid | FK → rooms(id) |
| reservation_room_id | uuid | FK → reservation_rooms(id), on delete set null |
| is_primary | boolean | |
| is_vip | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## Entity: ReservationCompanyInfo

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| reservation_id | uuid | FK → bookings(id), on delete cascade, unique |
| company_id | uuid | FK → contacts(id) |
| company_name | text | |
| contact_person_name | text | |
| contact_person_phone | text | |
| contact_person_email | text | |
| tax_number | text | |
| billing_address | text | |
| payment_terms | text | `pay_on_arrival`, `invoice_after_checkout`, `monthly_invoice`, `credit_account` |
| credit_limit | numeric(12,2) | |
| credit_approved | boolean | |
| company_rate_plan_id | uuid | |
| company_price_override_applied | boolean | |
| company_pays | text | `room_only`, `all_charges`, `room_and_tax` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## Entity: ReservationPricingItem

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| reservation_id | uuid | FK → bookings(id), on delete cascade |
| reservation_room_id | uuid | FK → reservation_rooms(id), on delete cascade; nullable |
| pricing_level | text | `room`, `extra`, `service`, `tax` |
| price_date | date | |
| room_id | uuid | FK → rooms(id) |
| room_type_id | uuid | FK → room_types(id) |
| base_rate | numeric(12,2) | |
| applied_rate | numeric(12,2) | |
| nights | integer | |
| quantity | integer | |
| discount_type | text | |
| discount_value | numeric(12,2) | |
| discount_amount | numeric(12,2) | |
| tax_amount | numeric(12,2) | |
| service_amount | numeric(12,2) | |
| total_amount | numeric(12,2) | |
| currency | text | |
| price_source | text | |
| manual_override_reason | text | |
| manual_override_by | uuid | FK → profiles(id) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Pricing Priority

```
manual override → company override → seasonal/event rate
→ room-specific rate → room-type default rate
```

Manual override requires: permission check, audit log, reason,
actor user ID.

---

## Entity: ReservationPayment

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| reservation_id | uuid | FK → bookings(id), on delete cascade |
| payment_type | text | `deposit`, `partial_payment`, `full_payment`, `refund`, `company_invoice`, `guarantee_only` |
| method | text | `cash`, `card`, `bank_transfer`, `company_credit`, `voucher`, `other` |
| amount | numeric(12,2) | |
| currency | text | |
| status | text | `pending`, `paid`, `refunded`, `failed` |
| transaction_reference | text | |
| receipt_number | text | |
| paid_by | text | `guest`, `company` |
| notes | text | |
| created_by | uuid | FK → profiles(id) |
| created_at | timestamptz | |

---

## Entity: ReservationHold

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| reservation_id | uuid | FK → bookings(id), on delete cascade; nullable |
| room_id | uuid | FK → rooms(id) |
| held_by_user_id | uuid | FK → profiles(id) |
| check_in_date | date | |
| check_out_date | date | |
| status | text | `active`, `expired`, `released`, `converted` |
| expires_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## Entity: ReservationNote

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| reservation_id | uuid | FK → bookings(id), on delete cascade |
| type | text | `front_desk`, `housekeeping`, `management`, `guest_facing` |
| visibility | text | `internal`, `guest_facing` |
| message | text | |
| created_by | uuid | FK → profiles(id) |
| created_at | timestamptz | |

---

## Entity: ReservationStatusHistory

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| reservation_id | uuid | FK → bookings(id), on delete cascade |
| from_status | text | |
| to_status | text | |
| reason | text | |
| changed_by | uuid | FK → profiles(id) |
| changed_at | timestamptz | |

---

## Entity: RoomStatusHistory (optional)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| room_id | uuid | FK → rooms(id) |
| from_status | text | |
| to_status | text | |
| reason | text | |
| reservation_id | uuid | FK → bookings(id), nullable |
| changed_by | uuid | FK → profiles(id) |
| changed_at | timestamptz | |
| metadata | jsonb | |

Only create if existing audit logs cannot provide reliable room
status history.

---

## Indexes

```sql
-- Reservations
create index idx_reservations_status on bookings(status) where deleted_at is null;
create index idx_reservations_dates on bookings(check_in, check_out) where deleted_at is null;
create index idx_reservations_company on bookings(company_id) where company_id is not null and deleted_at is null;
create index idx_reservations_primary_guest on bookings(primary_guest_id) where primary_guest_id is not null and deleted_at is null;

-- Reservation Rooms
create index idx_reservation_rooms_room_dates on reservation_rooms(room_id, check_in_date, check_out_date) where deleted_at is null;
create index idx_reservation_rooms_reservation on reservation_rooms(reservation_id) where deleted_at is null;
create index idx_reservation_rooms_date_range on reservation_rooms using gist (daterange(check_in_date, check_out_date, '[)'));

-- Reservation Holds
create index idx_reservation_holds_active on reservation_holds(room_id, check_in_date, check_out_date, expires_at) where status = 'active';

-- Status History
create index idx_reservation_status_history on reservation_status_history(reservation_id, changed_at desc);
create index idx_room_status_history_room_time on room_status_history(room_id, changed_at desc);

-- Notes
create index idx_reservation_notes on reservation_notes(reservation_id, created_at desc);
```

---

## RLS Strategy

- **API-only writes**: No direct Supabase client writes from browser.
  RLS policies can be permissive for authenticated users because
  server-side routes handle all mutations.
- **Service role bypass**: Server-side services use
  `createServiceRoleSupabaseClient()` (bypasses RLS).
- **Read policies**: Authenticated users with `bookings:read`
  permission can view reservations, rooms, guests, etc.
- **Write policies**: Only service-role client can write.
  Application layer enforces permissions via `secureMutationEndpoint`.

### Permission Actions (new)

```
reservation:confirm
reservation:cancel
reservation:check_in
reservation:check_out
reservation:override_price
reservation:record_payment
reservation:refund_payment
reservation:force_assign_room
```
