# Contract: `get_room_availability` RPC

**Feature**: 007-availability-service | **Phase**: 1 — Contract Definition

## Endpoint

```
SELECT * FROM get_room_availability(
  p_check_in_date       => '2026-07-01'::date,
  p_check_out_date      => '2026-07-03'::date,
  p_room_type_id        => NULL::uuid,
  p_company_id          => NULL::uuid,
  p_adults              => NULL::int,
  p_children            => NULL::int,
  p_include_dirty       => false,
  p_include_maintenance => false
);
```

## Function Signature

```sql
create or replace function public.get_room_availability(
  p_check_in_date       date,
  p_check_out_date      date,
  p_room_type_id        uuid      default null,
  p_company_id          uuid      default null,
  p_adults              int       default null,
  p_children            int       default null,
  p_include_dirty       boolean   default false,
  p_include_maintenance boolean   default false
)
returns table (
  room_id               uuid,
  room_number           text,
  room_type_id          uuid,
  room_type_name        text,
  floor                 int,
  capacity              int,
  current_room_status   text,
  availability_status   text,
  can_select            boolean,
  select_disabled_reason text,
  available_from        date,
  available_until       date,
  price_preview         jsonb,
  conflicts             jsonb
)
language plpgsql
stable
security definer
set search_path = public;
```

## Input Contract

### Required Parameters

| Parameter | Type | Validation |
|-----------|------|-----------|
| `p_check_in_date` | `date` | Must be < `p_check_out_date` |
| `p_check_out_date` | `date` | Must be > `p_check_in_date`. Stay ≤ 90 days. |

### Optional Parameters

| Parameter | Type | Default | Behavior |
|-----------|------|---------|----------|
| `p_room_type_id` | `uuid` | `null` | When non-null, filters results to rooms of this type |
| `p_company_id` | `uuid` | `null` | When non-null, applies company pricing override in `price_preview` |
| `p_adults` | `int` | `null` | When non-null, filters to rooms where `capacity >= adults + children` |
| `p_children` | `int` | `null` | Same as adults (added to total for capacity check) |
| `p_include_dirty` | `boolean` | `false` | When `true`, dirty rooms are included with status `available_after_cleaning` |
| `p_include_maintenance` | `boolean` | `false` | When `true`, maintenance/out-of-order rooms are included |

## Output Contract

### Row Columns

| Column | Type | Always Present | Description |
|--------|------|:---:|-------------|
| `room_id` | `uuid` | ✅ | Room primary key |
| `room_number` | `text` | ✅ | Room number (e.g. "101") |
| `room_type_id` | `uuid` | ✅ | FK to room_types |
| `room_type_name` | `text` | ✅ | Room type display name |
| `floor` | `int` | ✅ | Floor number |
| `capacity` | `int` | ✅ | Maximum occupancy |
| `current_room_status` | `text` | ✅ | Current physical status from `room_physical_status` enum |
| `availability_status` | `text` | ✅ | One of: `available_for_full_stay`, `booked`, `occupied_now`, `reserved_in_future`, `due_out_today`, `available_after_checkout`, `available_after_cleaning`, `partially_available`, `not_available`, `blocked`, `maintenance` |
| `can_select` | `boolean` | ✅ | Whether the room can be booked for the requested dates |
| `select_disabled_reason` | `text` | ✅ (nullable) | Human-readable reason when `can_select = false` |
| `available_from` | `date` | ✅ (nullable) | Earliest date the room becomes available (for partial statuses) |
| `available_until` | `date` | ✅ (nullable) | Date until which the room is available (for partial statuses) |
| `price_preview` | `jsonb` | ✅ | Non-null JSONB with pricing details |
| `conflicts` | `jsonb` | ✅ | JSONB array of conflict objects (empty array `[]` when no conflicts) |

### `price_preview` Shape

```jsonc
{
  "ratePerNight": 150.00,
  "totalAmount": 450.00,
  "currency": "USD",
  "priceSource": "default_rate"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `ratePerNight` | `number` | Nightly rate (decimal) |
| `totalAmount` | `number` | `ratePerNight × (p_check_out_date - p_check_in_date)` |
| `currency` | `string` | ISO 4217 currency code (e.g. "USD", "EUR") |
| `priceSource` | `string` | `"default_rate"` or `"company_override"` |

### `conflicts` Array Element Shape

```jsonc
[
  {
    "reservationId": "550e8400-e29b-41d4-a716-446655440000",
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

| Field | Type | Description |
|-------|------|-------------|
| `reservationId` | `string` (uuid) | Reservation primary key |
| `reservationNumber` | `string` | Human-readable reservation number |
| `guestName` | `string` | Primary guest full name |
| `companyName` | `string` | Company name (nullable) |
| `checkInDate` | `string` (date) | Existing reservation check-in date |
| `checkOutDate` | `string` (date) | Existing reservation check-out date |
| `conflictType` | `string` | One of: `date_overlap`, `active_hold`, `blocked`, `maintenance`, `occupied_now` |
| `message` | `string` | Human-readable conflict description |

## Error Contract

### Validation Exceptions

| Condition | Error Message |
|-----------|---------------|
| `p_check_in_date >= p_check_out_date` | `'Check-in date must be before check-out date'` |
| Stay duration > 90 days | `'Maximum stay is 90 days'` |

### Empty Results

When no rooms match the filters (not an error):
- The function returns zero rows (empty table result)
- No exception is raised

### Permission Denied

If the calling user lacks `can_read_reservations()` permission:
- Exception `42501` with message matching the Phase 6 permission guard

## Usage Examples

### Basic availability check
```sql
SELECT room_number, availability_status, can_select, price_preview->>'totalAmount' as total
FROM get_room_availability('2026-07-01', '2026-07-03')
WHERE availability_status = 'available_for_full_stay'
ORDER BY room_number;
```

### Availability with company pricing
```sql
SELECT room_number, availability_status, price_preview
FROM get_room_availability(
  '2026-07-01', '2026-07-03',
  p_company_id => '123e4567-e89b-12d3-a456-426614174000'
);
```

### Filtered by room type and capacity
```sql
SELECT room_number, availability_status
FROM get_room_availability(
  '2026-07-01', '2026-07-03',
  p_room_type_id => '223e4567-e89b-12d3-a456-426614174000',
  p_adults => 2,
  p_children => 1
);
```

### Conflict details for unavailable rooms
```sql
SELECT room_number, conflicts
FROM get_room_availability('2026-07-01', '2026-07-03')
WHERE can_select = false;
```
