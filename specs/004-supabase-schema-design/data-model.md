# Data Model: Supabase Schema Design

## Entity Relationship Overview

```text
reservations
  ├── reservation_rooms (1-to-many)
  ├── reservation_guests (1-to-many)
  ├── reservation_company_info (1-to-1)
  ├── reservation_pricing_items (1-to-many)
  ├── reservation_payments (1-to-many)
  ├── reservation_holds (1-to-many)
  ├── reservation_notes (1-to-many)
  ├── reservation_status_history (1-to-many)
  └── room_status_history (1-to-many, via room)

rooms ── reservation_rooms (1-to-many)
room_types ── reservation_rooms (many-to-1)
guests ── reservation_guests (many-to-many)
contacts ── reservation_company_info (1-to-1); reservations.company_id
profiles ── reservations.created_by/updated_by, etc.
```

## Enums

| Enum | Values |
|------|--------|
| `reservation_status` | draft, held, confirmed, checked_in, checked_out, cancelled, no_show, expired |
| `reservation_booking_type` | individual, company, group, travel_agent, internal |
| `billing_party` | guest, company, split, complimentary |
| `reservation_source` | walk_in, phone, website, whatsapp, email, company, travel_agent, ota, manual |
| `reservation_room_status` | selected, held, reserved, occupied, checked_out, cancelled, released |
| `reservation_guest_role` | primary_guest, additional_guest, company_guest, child |
| `reservation_payment_type` | deposit, partial_payment, full_payment, refund, company_invoice, guarantee_only |
| `reservation_payment_method` | cash, card, bank_transfer, company_credit, voucher, other |
| `price_source` | default_room_type_rate, room_specific_rate, company_override, seasonal_rate, manual_override |
| `room_physical_status` | available, occupied, dirty, clean, inspected, maintenance, out_of_order, blocked, reserved_future, due_out, due_in |

## Entity Definitions

### 1. reservations (Parent Record)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| reservation_number | text | NOT NULL, UNIQUE | Auto-generated: RSV-YYYYMMDD-{random} |
| booking_type | reservation_booking_type | NOT NULL | |
| status | reservation_status | NOT NULL, default 'draft' | |
| source | reservation_source | NOT NULL, default 'manual' | |
| check_in_date | date | NOT NULL | |
| check_out_date | date | NOT NULL | |
| check_in_time | time | | |
| check_out_time | time | | |
| nights | integer | NOT NULL, CHECK > 0 | |
| adults | integer | NOT NULL, default 1 | |
| children | integer | NOT NULL, default 0 | |
| infants | integer | NOT NULL, default 0 | |
| room_count | integer | NOT NULL, default 1, CHECK > 0 | |
| primary_guest_id | uuid | FK → guests(id) ON DELETE SET NULL | |
| company_id | uuid | FK → contacts(id) ON DELETE SET NULL | |
| booker_name | text | | |
| booker_phone | text | | |
| booker_email | text | | |
| billing_party | billing_party | NOT NULL, default 'guest' | |
| currency | text | NOT NULL, default 'USD' | |
| subtotal_amount | numeric(12,2) | NOT NULL, default 0 | |
| discount_amount | numeric(12,2) | NOT NULL, default 0 | |
| tax_amount | numeric(12,2) | NOT NULL, default 0 | |
| service_amount | numeric(12,2) | NOT NULL, default 0 | |
| total_amount | numeric(12,2) | NOT NULL, default 0 | |
| paid_amount | numeric(12,2) | NOT NULL, default 0 | |
| balance_amount | numeric(12,2) | NOT NULL, default 0 | |
| guarantee_type | text | NOT NULL, default 'none' | |
| special_requests | text | | |
| internal_notes | text | | |
| created_by | uuid | NOT NULL, FK → profiles(id) | |
| updated_by | uuid | FK → profiles(id) | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | Trigger updated |
| cancelled_at | timestamptz | | |
| checked_in_at | timestamptz | | |
| checked_out_at | timestamptz | | |
| deleted_at | timestamptz | | Soft delete |

**Constraints**: checkout > checkin, nights > 0, room_count > 0, adults >= 0, children >= 0, infants >= 0, (adults + children) > 0, total >= 0, paid >= 0, balance >= 0.

### 2. reservation_rooms (Room Assignments)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| reservation_id | uuid | NOT NULL, FK → reservations ON DELETE CASCADE | |
| room_id | uuid | NOT NULL, FK → rooms | |
| room_type_id | uuid | NOT NULL, FK → room_types | |
| stay_segment_type | text | NOT NULL, default 'full_stay' | full_stay, split_stay |
| check_in_date | date | NOT NULL | |
| check_out_date | date | NOT NULL | |
| status | reservation_room_status | NOT NULL, default 'selected' | |
| adults | integer | NOT NULL, default 1 | |
| children | integer | NOT NULL, default 0 | |
| infants | integer | NOT NULL, default 0 | |
| assigned_guest_id | uuid | FK → guests ON DELETE SET NULL | |
| rate_per_night | numeric(12,2) | NOT NULL, default 0 | |
| nights | integer | NOT NULL | |
| subtotal_amount | numeric(12,2) | NOT NULL, default 0 | |
| discount_amount | numeric(12,2) | NOT NULL, default 0 | |
| tax_amount | numeric(12,2) | NOT NULL, default 0 | |
| total_amount | numeric(12,2) | NOT NULL, default 0 | |
| price_source | price_source | NOT NULL, default 'default_room_type_rate' | |
| housekeeping_requirement | text | NOT NULL, default 'clean_required' | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | Trigger updated |
| deleted_at | timestamptz | | Soft delete |

**Conflict Prevention**: Exclusion constraint `reservation_rooms_no_overlap` using GiST index on `daterange(check_in_date, check_out_date, '[)')` for active statuses (held, reserved, occupied).

### 3. reservation_guests (Guest Associations)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| reservation_id | uuid | NOT NULL, FK → reservations ON DELETE CASCADE | |
| guest_id | uuid | FK → guests ON DELETE SET NULL | |
| role | reservation_guest_role | NOT NULL, default 'additional_guest' | |
| full_name | text | NOT NULL | |
| phone | text | | |
| email | text | | |
| nationality | text | | |
| document_type | text | | |
| document_number | text | | |
| assigned_room_id | uuid | FK → rooms ON DELETE SET NULL | |
| reservation_room_id | uuid | FK → reservation_rooms ON DELETE SET NULL | |
| is_primary | boolean | NOT NULL, default false | |
| is_vip | boolean | NOT NULL, default false | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | Trigger updated |

**Constraint**: Partial unique index `reservation_guests_single_primary` ensures at most one primary guest per reservation.

### 4. reservation_company_info (Company Billing)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| reservation_id | uuid | NOT NULL, UNIQUE, FK → reservations ON DELETE CASCADE | 1-to-1 |
| company_id | uuid | NOT NULL, FK → contacts | |
| company_name | text | NOT NULL | |
| contact_person_name | text | | |
| contact_person_phone | text | | |
| contact_person_email | text | | |
| tax_number | text | | |
| billing_address | text | | |
| payment_terms | text | NOT NULL, default 'pay_on_arrival' | |
| credit_limit | numeric(12,2) | | |
| credit_approved | boolean | NOT NULL, default false | |
| company_rate_plan_id | uuid | | |
| company_price_override_applied | boolean | NOT NULL, default false | |
| company_pays | text | NOT NULL, default 'room_only' | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | Trigger updated |

### 5. reservation_pricing_items (Itemized Pricing)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| reservation_id | uuid | NOT NULL, FK → reservations ON DELETE CASCADE | |
| reservation_room_id | uuid | FK → reservation_rooms ON DELETE CASCADE | |
| pricing_level | text | NOT NULL, default 'room' | room, reservation |
| price_date | date | | |
| room_id | uuid | | |
| room_type_id | uuid | | |
| base_rate | numeric(12,2) | NOT NULL, default 0 | |
| applied_rate | numeric(12,2) | NOT NULL, default 0 | |
| nights | integer | NOT NULL, default 1 | |
| quantity | integer | NOT NULL, default 1 | |
| discount_type | text | | |
| discount_value | numeric(12,2) | | |
| discount_amount | numeric(12,2) | NOT NULL, default 0 | |
| tax_amount | numeric(12,2) | NOT NULL, default 0 | |
| service_amount | numeric(12,2) | NOT NULL, default 0 | |
| total_amount | numeric(12,2) | NOT NULL, default 0 | |
| currency | text | NOT NULL, default 'USD' | |
| price_source | price_source | NOT NULL | |
| manual_override_reason | text | | |
| manual_override_by | uuid | FK → profiles | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | Trigger updated |

### 6. reservation_payments (Payments)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| reservation_id | uuid | NOT NULL, FK → reservations ON DELETE CASCADE | |
| payment_type | reservation_payment_type | NOT NULL | |
| method | reservation_payment_method | NOT NULL | |
| amount | numeric(12,2) | NOT NULL | |
| currency | text | NOT NULL, default 'USD' | |
| status | text | NOT NULL, default 'pending' | |
| transaction_reference | text | | |
| receipt_number | text | | |
| paid_by | text | NOT NULL, default 'guest' | |
| notes | text | | |
| created_by | uuid | NOT NULL, FK → profiles | |
| created_at | timestamptz | NOT NULL, default now() | |

**Constraint**: amount > 0.

### 7. reservation_holds (Room Holds)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| reservation_id | uuid | FK → reservations ON DELETE CASCADE | |
| room_id | uuid | NOT NULL, FK → rooms | |
| held_by_user_id | uuid | NOT NULL, FK → profiles | |
| check_in_date | date | NOT NULL | |
| check_out_date | date | NOT NULL | |
| status | text | NOT NULL, default 'active' | |
| expires_at | timestamptz | NOT NULL | Default: created_at + 30m |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | Trigger updated |

**Constraint**: checkout > checkin.

### 8. reservation_notes (Operational Notes)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| reservation_id | uuid | NOT NULL, FK → reservations ON DELETE CASCADE | |
| type | text | NOT NULL, default 'front_desk' | |
| visibility | text | NOT NULL, default 'internal' | |
| message | text | NOT NULL | |
| created_by | uuid | NOT NULL, FK → profiles | |
| created_at | timestamptz | NOT NULL, default now() | |

### 9. reservation_status_history (Status Tracking)

Immutable log of reservation status changes.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| reservation_id | uuid | NOT NULL, FK → reservations ON DELETE CASCADE | |
| from_status | text | | Null for initial creation |
| to_status | text | NOT NULL | |
| reason | text | | |
| changed_by | uuid | NOT NULL, FK → profiles | |
| changed_at | timestamptz | NOT NULL, default now() | |

### 10. room_status_history (Housekeeping/Maintenance)

Lightweight history of room physical status changes.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| room_id | uuid | NOT NULL, FK → rooms | |
| from_status | text | | |
| to_status | text | NOT NULL | |
| reason | text | | |
| reservation_id | uuid | FK → reservations | |
| changed_by | uuid | NOT NULL, FK → profiles | |
| changed_at | timestamptz | NOT NULL, default now() | |
| metadata | jsonb | NOT NULL, default '{}' | |

## Status Transitions

### Reservation Lifecycle (reservations.status)

```text
draft → held → confirmed → checked_in → checked_out
draft → cancelled
held → expired | cancelled
confirmed → cancelled | no_show
```

### Room Assignment (reservation_rooms.status)

```text
selected → held → reserved → occupied → checked_out
cancelled (from any active state)
released (from selected, held)
```

### Hold Status (reservation_holds.status)

```text
active → expired (auto, after expires_at)
active → converted (on reservation confirm)
active → released (manual release)
```

## RPC Functions

The migration defines these transactional RPCs for safety:

### `confirm_reservation(p_reservation_id uuid, p_user_id uuid) → jsonb`

Validates: reservation exists, status is draft/held, no room conflicts. Transitions: rooms → reserved, reservation → confirmed, writes status history, releases holds.

### `cancel_reservation(p_reservation_id uuid, p_reason text, p_user_id uuid) → jsonb`

Validates: not already in checked_out/cancelled/expired. Releases rooms and holds. Writes status history.

### `get_room_availability(...) → table`

Room availability query supporting date range, room type filter, occupancy filtering, dirty/maintenance inclusion options. Returns availability status and conflict details.

## Indexes

Core indexes cover: status filtering, date-range queries, FK lookups, and active hold searches. See migration file for full list.

## RLS Policies

All reservation tables enabled for row-level security. Three helper functions control access:
- `can_read_reservations()` — admin, accountant, front_desk
- `can_write_reservations()` — admin, front_desk
- `can_override_pricing()` — admin only

Each table has select/insert/update policies for authenticated users based on these helpers.
