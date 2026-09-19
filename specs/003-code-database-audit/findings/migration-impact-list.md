# Migration Impact List

Status: reservation migrations are already present in the repository. This list records the ordered schema impact and follow-up checks needed before production use.

## Ordered Changes

1. Enable database prerequisites
   - Add/verify `btree_gist` for exclusion constraints.
   - Optionally verify `pg_cron` for expired hold cleanup scheduling.

2. Add reservation enum types
   - Reservation status, booking type, billing party, source, reservation room status, guest role, payment type, payment method, price source, and room physical status.

3. Create parent table
   - Create `reservations` with guest/contact references, stay dates, status, source, booking type, billing party, totals, and audit metadata.

4. Create child tables
   - `reservation_rooms`
   - `reservation_guests`
   - `reservation_company_info`
   - `reservation_pricing_items`
   - `reservation_payments`
   - `reservation_holds`
   - `reservation_notes`
   - `reservation_status_history`
   - `room_status_history`

5. Add relationships
   - Foreign keys from reservation children to `reservations`.
   - Foreign keys to `rooms`, `guests`, `contacts`, room types, accounting payments, and user/profile references where applicable.

6. Add indexes and constraints
   - Date/range indexes for room availability queries.
   - Hold expiration/status indexes.
   - Reservation status/date lookup indexes.
   - Exclusion constraint on `reservation_rooms` to prevent overlapping active stays per room.

7. Add RLS and policies
   - Enable RLS on new reservation tables.
   - Add read/write policies matching authenticated roles and service-role workflow patterns.
   - Verify route/service permission checks for high-risk actions.

8. Add RPC/workflow functions
   - Availability query support.
   - Confirm reservation.
   - Check-in and check-out reservation.
   - Expired hold release function and schedule/worker path.

9. Regenerate client types
   - Regenerate/update Supabase TypeScript database types after migrations.
   - Ensure module types map to generated enum/table names.

10. Validate application integration
   - Confirm `/api/reservations` routes call the new service/RPC layer.
   - Confirm room routes expose history without leaking unrelated data.
   - Confirm accounting integration for reservation payments/invoices.

## Follow-Up Impact Checks

- Align `room_physical_status` with existing app `RoomStatus` values (`cleaning` vs `dirty` semantics).
- Decide legacy `bookings` migration/archive/reporting strategy.
- Define reconciliation between `reservation_payments` and accounting `payments`/ledger.
- Verify live Supabase environment has these migrations applied; this session only inspected checked-in files.
