# Data Model: Availability RPC

**Feature**: 007-availability-service | **Phase**: 1 — Design

## Overview

This phase does **not introduce new tables** or columns. All data sources are existing Phase 2 tables. The enhancement is purely in the `get_room_availability` RPC return shape and logic.

## Return Shape

The existing RPC uses `returns table(...)` with flat columns and single conflict entry per row. The enhanced RPC extends this to include two `jsonb` columns for nested structures.

```sql
returns table (
  -- Existing scalar columns (preserved)
  room_id uuid,
  room_number text,
  room_type_id uuid,
  room_type_name text,
  floor int,
  capacity int,
  current_room_status text,       -- From room_physical_status enum

  -- Enhanced availability status (11 values instead of 7)
  availability_status text,       -- See status matrix below

  -- New scalar columns
  can_select boolean,
  select_disabled_reason text,
  available_from date,             -- For partially_available / reserved_in_future
  available_until date,            -- For available_after_checkout / due_out_today

  -- New JSONB columns
  price_preview jsonb,             -- { ratePerNight, totalAmount, currency, priceSource }
  conflicts jsonb                  -- [{ reservationId, reservationNumber, guestName, ... }]
)
```

### JSONB Column Shapes

#### `price_preview`
```json
{
  "ratePerNight": 150.00,
  "totalAmount": 450.00,
  "currency": "USD",
  "priceSource": "default_rate"
}
```

- `ratePerNight`: decimal — nightly rate (from company override or room type default)
- `totalAmount`: decimal — `ratePerNight × number of nights (check_out - check_in)`
- `currency`: text — ISO 4217 currency code, from `room_types.currency`
- `priceSource`: text — either `'default_rate'` or `'company_override'`

#### `conflicts` (array)
```json
[
  {
    "reservationId": "uuid",
    "reservationNumber": "RN-001",
    "guestName": "John Doe",
    "companyName": "Acme Corp",
    "checkInDate": "2026-07-01",
    "checkOutDate": "2026-07-03",
    "conflictType": "date_overlap",
    "message": "Room is booked by John Doe from Jul 1 to Jul 3"
  }
]
```

- `conflictType` values: `'date_overlap'`, `'active_hold'`, `'blocked'`, `'maintenance'`, `'occupied_now'`

## Availability Status Matrix

| Status | `canSelect` | Condition |
|--------|-------------|-----------|
| `available_for_full_stay` | true | No overlapping reservations/holds. Room clean. Not under maintenance. |
| `booked` | false | Overlapping reservation covering full requested range (check_in <= p_check_in AND check_out >= p_check_out). |
| `occupied_now` | false | Reservation with status='occupied' and current date overlaps. |
| `reserved_in_future` | false | Reservation exists but check_in > p_check_in. Room not currently occupied. |
| `due_out_today` | true | Guest due to check out today (check_out = p_check_in). Available after housekeeping. |
| `available_after_checkout` | true | Reservation ends before p_check_out. Room available from check_out date. |
| `available_after_cleaning` | false | Room is dirty (`housekeeping_status = 'dirty'`) and `p_include_dirty = false`. |
| `partially_available` | true | Partial overlap — reservation covers only part of the requested range. |
| `not_available` | false | Multiple reservations collectively cover the full requested range. |
| `blocked` | false | `room_physical_status = 'blocked'` (out of order without maintenance flag). |
| `maintenance` | false | `room_physical_status` in `('maintenance', 'out_of_order')` and `p_include_maintenance = false`. |

### `canSelect` Truth Table

| Status | canSelect | selectDisabledReason |
|--------|-----------|---------------------|
| `available_for_full_stay` | true | null |
| `due_out_today` | true | "Room available after {check_out_time}" |
| `available_after_checkout` | true | "Available from {date}" |
| `partially_available` | true | "Partially available — see availableFrom/availableUntil" |
| `booked` | false | "Booked from {reservation.check_in} to {reservation.check_out}" |
| `occupied_now` | false | "Currently occupied until {check_out}" |
| `reserved_in_future` | false | "Reserved from {future_check_in}" |
| `available_after_cleaning` | false | "Room needs cleaning" |
| `not_available` | false | "Not available — all dates conflict" |
| `blocked` | false | "Room is blocked" |
| `maintenance` | false | "Room under maintenance" |

## Data Sources (Existing Tables)

| Entity | Tables | Used For |
|--------|--------|----------|
| Rooms | `rooms` | Room base data: id, number, room_type_id, floor, capacity, physical_status, housekeeping_status |
| Room Types | `room_types` | Type name, default_rate, currency |
| Reservations | `reservations` | Parent record for date range and metadata |
| Reservation Rooms | `reservation_rooms` | Core overlap detection: room_id, check_in_date, check_out_date, status |
| Reservation Holds | `reservation_holds` | Active hold detection: room_id, check_in/out, status, expires_at |
| Reservation Pricing Items | `reservation_pricing_items` | (Future use — not needed for simple pricing) |
| Company Price Overrides | `company_price_overrides` | Company-specific pricing: company_id, room_type_id, override_rate |
| Guests | `guests` | Conflict guest name resolution |
| Contacts | `contacts` | Company name resolution (acts as companies table) |

## RPC Parameters

| Parameter | Type | Required | Default | Purpose |
|-----------|------|----------|---------|---------|
| `p_check_in_date` | date | ✅ | — | Start of requested stay |
| `p_check_out_date` | date | ✅ | — | End of requested stay |
| `p_room_type_id` | uuid | ❌ | null | Filter by room type |
| `p_company_id` | uuid | ❌ | null | Company context for pricing override |
| `p_adults` | int | ❌ | null | Filter by minimum adult capacity |
| `p_children` | int | ❌ | null | Filter by minimum child capacity (added to adults) |
| `p_include_dirty` | boolean | ❌ | false | Include dirty rooms in results |
| `p_include_maintenance` | boolean | ❌ | false | Include maintenance/out-of-order rooms |

## Function Design

- **Name**: `get_room_availability` (enhanced, not replaced)
- **Language**: PL/pgSQL
- **Security**: `security definer` with `can_read_reservations()` permission guard
- **Stability**: `stable` (read-only, no data modification)
- **Migration**: `supabase/migrations/20260628000003_enhance_room_availability_rpc.sql`

## Key Query Structure

```sql
-- Pseudo-architecture of the enhanced query:
WITH
  room_base AS ( ... ),                   -- All rooms with filters
  pricing AS ( ... ),                      -- Per-room pricing (company override or default)
  overlapping_rooms AS ( ... ),            -- Conflicts from reservation_rooms
  active_holds AS ( ... ),                 -- Conflicts from reservation_holds
  conflicts AS (                          -- Aggregated conflict details per room
    SELECT room_id, jsonb_agg(...) AS conflicts
    FROM (...) GROUP BY room_id
  )
SELECT
  rb.*,
  pricing.price_preview,
  COALESCE(cf.conflicts, '[]'::jsonb) AS conflicts
FROM room_base rb
LEFT JOIN pricing ON ...
LEFT JOIN conflicts cf ON cf.room_id = rb.id
ORDER BY rb.number;
```
