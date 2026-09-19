# Data Model: Indexes and Performance

This phase adds no new tables. It documents the required indexes on the existing reservation tables from Phase 2 (004-supabase-schema-design). Indexes are already defined in `supabase/migrations/20260628000001_create_reservation_model.sql` — this document serves as the specification of which indexes must exist and what query patterns they support.

## Index Inventory

### 1. reservations

| Index Name | Columns | Partial Condition | Query Pattern | FR |
|------------|---------|-------------------|---------------|-----|
| idx_reservations_status | status | WHERE deleted_at IS NULL | Filter by reservation status (active, cancelled, completed) | FR-001 |
| idx_reservations_dates | (check_in_date, check_out_date) | WHERE deleted_at IS NULL | Date-range search for reservations | FR-002 |
| idx_reservations_company | company_id | WHERE company_id IS NOT NULL AND deleted_at IS NULL | Company-filtered reservation lookup | FR-003 |
| idx_reservations_primary_guest | primary_guest_id | WHERE primary_guest_id IS NOT NULL AND deleted_at IS NULL | Guest reservation lookup | FR-004 |
| idx_reservations_created_by | created_by | WHERE deleted_at IS NULL | Staff shift/activity queries | Supporting |
| idx_reservations_number | reservation_number | (none — full index) | Direct reservation lookup by number | Supporting |

### 2. reservation_rooms

| Index Name | Columns | Partial Condition | Query Pattern | FR |
|------------|---------|-------------------|---------------|-----|
| idx_reservation_rooms_room_dates | (room_id, check_in_date, check_out_date) | WHERE deleted_at IS NULL | Room availability by date range | FR-005 |
| idx_reservation_rooms_reservation | reservation_id | WHERE deleted_at IS NULL | FK lookup from room to parent reservation | FR-006 |
| idx_reservation_rooms_status | status | WHERE deleted_at IS NULL | Room assignments filtered by status | Supporting |

### 3. reservation_guests

| Index Name | Columns | Partial Condition | Query Pattern | FR |
|------------|---------|-------------------|---------------|-----|
| idx_reservation_guests_reservation | reservation_id | (none) | FK lookup by parent reservation | FR-009 |
| idx_reservation_guests_guest | guest_id | WHERE guest_id IS NOT NULL | Guest association lookup by guest ID | FR-010 |
| reservation_guests_single_primary | (reservation_id) | WHERE is_primary = true | Unique constraint (not B-tree, already exists) | Supporting |

### 4. reservation_company_info

No additional indexes beyond the UNIQUE constraint on `reservation_id` (defined inline in table DDL).

### 5. reservation_pricing_items

| Index Name | Columns | Partial Condition | Query Pattern | FR |
|------------|---------|-------------------|---------------|-----|
| idx_reservation_pricing_items_reservation | reservation_id | (none) | Pricing items by reservation | FR-012 |
| idx_reservation_pricing_items_room | reservation_room_id | WHERE reservation_room_id IS NOT NULL | Pricing items by room assignment | FR-012 |

### 6. reservation_payments

| Index Name | Columns | Partial Condition | Query Pattern | FR |
|------------|---------|-------------------|---------------|-----|
| idx_reservation_payments_reservation | reservation_id | (none) | Payments by reservation | FR-011 |

### 7. reservation_holds

| Index Name | Columns | Partial Condition | Query Pattern | FR |
|------------|---------|-------------------|---------------|-----|
| idx_reservation_holds_active | (room_id, check_in_date, check_out_date, expires_at) | WHERE status = 'active' | Active hold lookup and availability | FR-008 |
| idx_reservation_holds_reservation | reservation_id | (none) | Hold lookup by reservation | Supporting |

### 8. reservation_notes

| Index Name | Columns | Partial Condition | Query Pattern | FR |
|------------|---------|-------------------|---------------|-----|
| idx_reservation_notes_reservation | (reservation_id, created_at DESC) | (none) | Notes sorted by creation time | FR-014 |

### 9. reservation_status_history

| Index Name | Columns | Partial Condition | Query Pattern | FR |
|------------|---------|-------------------|---------------|-----|
| idx_reservation_status_history_reservation | (reservation_id, changed_at DESC) | (none) | Status history by reservation, reverse chronological | FR-013 |

### 10. room_status_history

| Index Name | Columns | Partial Condition | Query Pattern | FR |
|------------|---------|-------------------|---------------|-----|
| idx_room_status_history_room_time | (room_id, changed_at DESC) | (none) | Room status changes by room, reverse chronological | FR-015 |

## Performance Target Mapping

| Query Pattern | Expected Index | Target Time |
|---------------|---------------|-------------|
| `SELECT * FROM reservations WHERE status = 'confirmed' AND deleted_at IS NULL` | idx_reservations_status | < 1s |
| `SELECT * FROM reservations WHERE check_in_date >= '2026-07-01' AND check_in_date < '2026-07-08' AND deleted_at IS NULL` | idx_reservations_dates | < 2s |
| `SELECT * FROM reservation_rooms WHERE room_id = :r AND check_in_date < :out AND check_out_date > :in AND deleted_at IS NULL` | idx_reservation_rooms_room_dates | < 2s |
| `SELECT * FROM reservations WHERE company_id = :c AND deleted_at IS NULL` | idx_reservations_company | < 2s |
| `SELECT r.*, SUM(p.amount) FROM reservations r JOIN reservation_payments p ON p.reservation_id = r.id GROUP BY r.id` | idx_reservation_payments_reservation (index-only join) | < 5s |
| `SELECT * FROM reservation_status_history WHERE reservation_id = :r ORDER BY changed_at DESC` | idx_reservation_status_history_reservation | < 1s |

## Verification SQL

```sql
-- Confirm all 16+ indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename LIKE 'reservation_%'
   OR tablename = 'room_status_history'
ORDER BY tablename, indexname;

-- Check index metadata
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname IN (
  'idx_reservations_status',
  'idx_reservations_dates',
  'idx_reservations_company',
  'idx_reservations_primary_guest',
  'idx_reservations_created_by',
  'idx_reservations_number',
  'idx_reservation_rooms_room_dates',
  'idx_reservation_rooms_reservation',
  'idx_reservation_rooms_status',
  'idx_reservation_guests_reservation',
  'idx_reservation_guests_guest',
  'idx_reservation_pricing_items_reservation',
  'idx_reservation_pricing_items_room',
  'idx_reservation_payments_reservation',
  'idx_reservation_holds_active',
  'idx_reservation_holds_reservation',
  'idx_reservation_notes_reservation',
  'idx_reservation_status_history_reservation',
  'idx_room_status_history_room_time'
);
```
