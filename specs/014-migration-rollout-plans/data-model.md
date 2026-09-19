# Data Model — Migration Rollout Plans

## Seed Data Entities

### Room Types (already seeded, referenced)

| Slug | Name | Base Price | Capacity | Room Count |
|------|------|-----------|----------|------------|
| standard | Standard | 100.00 | 2 | 4 rooms |
| deluxe | Deluxe | 180.00 | 2 | 4 rooms |
| suite | Suite | 350.00 | 4 | 2 rooms |

### Rooms (to be seeded)

| Number | Floor | Type Slug | Status | Capacity |
|--------|-------|-----------|--------|----------|
| 101 | 1 | standard | available | 2 |
| 102 | 1 | standard | available | 2 |
| 103 | 1 | deluxe | available | 2 |
| 104 | 1 | deluxe | available | 2 |
| 105 | 1 | standard | maintenance | 2 |
| 106 | 1 | standard | cleaning (dirty) | 2 |
| 201 | 2 | deluxe | available | 2 |
| 202 | 2 | deluxe | available | 2 |
| 301 | 3 | suite | available | 4 |
| 302 | 3 | suite | available | 4 |

**Idempotency key**: `number` (unique constraint)

### Guests (to be seeded)

**Guest 1** (individual booking)
- first_name: Ahmed, last_name: Ali
- email: ahmed.ali@example.com
- phone: +966500000001
- country: SA
- passport_number: P1234567
- status: active

**Guest 2** (company guest)
- first_name: Sara, last_name: Khan
- email: sara.khan@example.com
- phone: +966500000002
- country: SA
- passport_number: P1234568
- status: active

**Idempotency key**: `email` (unique constraint)

### Contacts (companies, to be seeded)

**Company 1** (Al-Mawarid Trading)
- name: Al-Mawarid Trading
- type: company
- phone: +966120000001
- email: info@almawarid.example.com

**Idempotency key**: `email` or company-specific unique column

### Company Price Override (to be seeded)

- company: Al-Mawarid Trading
- room_type: standard
- override_price: 80.00 (20% discount from 100.00)
- reason: Corporate rate agreement

### Reservations (to be seeded)

**RSV-001** — Checked-in individual booking
- reservation_number: RSV-SEED-001
- booking_type: individual
- status: checked_in
- check_in_date: CURRENT_DATE - 2
- check_out_date: CURRENT_DATE + 2
- primary_guest: Ahmed Ali
- room: 101 (standard)
- total_amount: 400.00 (4 nights × $100)
- room_count: 1, adults: 1, children: 0

**RSV-002** — Checked-out individual booking
- reservation_number: RSV-SEED-002
- booking_type: individual
- status: checked_out
- check_in_date: CURRENT_DATE - 7
- check_out_date: CURRENT_DATE - 5
- primary_guest: Ahmed Ali
- room: 103 (deluxe)
- total_amount: 360.00 (2 nights × $180)
- checked_out_at: CURRENT_DATE - 5 at 12:00

**RSV-003** — Future company booking
- reservation_number: RSV-SEED-003
- booking_type: company
- status: confirmed
- check_in_date: CURRENT_DATE + 5
- check_out_date: CURRENT_DATE + 8
- company: Al-Mawarid Trading
- room: 201 (deluxe)
- room_count: 2
- billing_party: company
- total_amount: 480.00 (2 rooms × 3 nights × $80 company override)

**Idempotency key**: `reservation_number` (unique constraint)

### Related Seed Records

Per reservation, the seed migration must also insert:
- **reservation_rooms**: One row per room assignment
- **reservation_guests**: One row per guest assigned to reservation
- **reservation_company_info**: For RSV-003 (company booking)
- **reservation_pricing_items**: Calculated pricing for each room
- **reservation_status_history**: Initial status entry
- **reservation_notes**: Optional operational notes

## Hold Expiry RPC

### `expire_reservation_holds()`

**Purpose**: Called by pg_cron job every 1 minute to expire stale holds

**Signature**: `public.expire_reservation_holds() returns void`

**Behavior**:
1. Find all `reservation_holds` where `status = 'active'` AND `expires_at < now()`
2. For each expired hold:
   a. Update `status` to `expired`, `updated_at` to `now()`
   b. Insert audit log entry with action `hold_expired`
3. Returns void; idempotent (re-running processes only holds still active and expired)

**Concurrency safety**: `FOR UPDATE` lock on selected rows to prevent race with confirmation RPC

## Verification Script Check Categories

| Category | # Checks | What It Verifies |
|---|---|---|
| Extensions | 2 | btree_gist, pg_cron exist |
| Enums | 10 | All 10 reservation enums exist |
| Tables | 10 | All 10 reservation tables + room_status_history exist |
| Columns | per table | Key columns exist and have correct data types |
| Constraints | ~5 | Check constraints present (dates, amounts, counts) |
| Indexes | ~15 | Performance indexes from schema design |
| RLS | 10 | Each table has RLS enabled + policies |
| RPCs | 3 | Availability, confirm, cancel RPCs exist |
| Triggers | ~8 | Updated_at triggers on each table |
| Seed Data | 5 | Counts match expected (rooms, guests, companies, reservations, holds) |
