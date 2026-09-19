# Quickstart: RLS and Security Validation

## Prerequisites

- Phase 2 migration (`20260628000001_create_reservation_model.sql`) applied
- Phase 3 index migration (005) applied
- This phase's migration (`20260628000002_refine_reservation_rls.sql`) applied
- Supabase project with test data (at least one reservation in non-terminal state)
- Access to Supabase SQL editor or `psql`

## Validation Scenarios

### 1. Verify RLS Is Enabled on All Tables

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'reservation_%'
ORDER BY tablename;
```

**Expected**: All 9 tables show `rowsecurity = true`.

### 2. Verify Policy Count Per Table

```sql
SELECT schemaname, tablename, count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'reservation_%'
GROUP BY schemaname, tablename
ORDER BY tablename;
```

**Expected**: 3-4 policies per table (SELECT, INSERT, UPDATE, DELETE where applicable). Append-only tables (reservation_status_history, room_status_history) have only SELECT + INSERT.

### 3. Front Desk: Can Create Reservation

Connect as a user with `app_role = 'front_desk'`:

```sql
INSERT INTO public.reservations (
  booking_type, status, source, check_in_date, check_out_date,
  nights, adults, primary_guest_id, created_by
) VALUES (
  'individual', 'draft', 'walk_in',
  CURRENT_DATE, CURRENT_DATE + 1,
  1, 1, '<guest_uuid>', auth.uid()
);
```

**Expected**: Insert succeeds.

### 4. Front Desk: Cannot Override Pricing

```sql
UPDATE public.reservations
SET total_amount = 0
WHERE id = '<reservation_uuid>';
```

**Expected**: RLS blocks the update (permission denied). Note: If no pricing columns are being changed, the update succeeds.

### 5. Front Desk: Cannot Delete Reservation

```sql
DELETE FROM public.reservations
WHERE id = '<reservation_uuid>';
```

**Expected**: RLS blocks the delete (permission denied).

### 6. Front Desk: Cannot Cancel via RPC

```sql
SELECT public.cancel_reservation('<reservation_uuid>');
```

**Expected**: Function raises `42501` insufficient privilege.

### 7. Accountant: Can Read But Cannot Write

```sql
-- Should succeed
SELECT * FROM public.reservations LIMIT 1;

-- Should fail
INSERT INTO public.reservations (...) VALUES (...);
```

**Expected**: SELECT succeeds, INSERT fails with permission denied.

### 8. Terminal State Protection

```sql
-- Assuming <reservation_uuid> is checked_out
UPDATE public.reservation_rooms
SET status = 'reserved'
WHERE reservation_id = '<reservation_uuid>';
```

**Expected**: RLS blocks the update (terminal state check in WITH CHECK).

### 9. Unauthenticated User: All Operations Blocked

Connect without authentication (anon key):

```sql
SELECT * FROM public.reservations LIMIT 1;
```

**Expected**: Returns empty set or permission denied (default-deny for unauthenticated).

### 10. Audit Log Verification

After performing a reservation mutation as an authenticated user:

```sql
SELECT action, actor, target, created_at
FROM public.audit_logs
WHERE module = 'reservations'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**: Most recent reservation mutation appears with correct action, actor ID, and target.

## Running All Tests

Execute the validation scripts in this order:

1. `specs/006-rls-and-security/quickstart.md` — manual SQL scenarios above
2. Verify each scenario for all 3 roles (admin, front_desk, accountant)
3. Verify terminal state protection for all 3 terminal states (checked_out, cancelled, no_show)
4. Verify audit log entries for each mutation type

## Success Criteria

- [ ] All 9 reservation tables have RLS enabled (SC-002)
- [ ] Front desk can CRUD basic reservation data but cannot override pricing, delete, or cancel (SC-001, SC-003)
- [ ] Accountant can read all tables but cannot write any (SC-001, SC-003)
- [ ] Pricing-sensitive column writes are blocked for non-admin (SC-004)
- [ ] Terminal state writes are blocked for all roles (SC-005)
- [ ] Audit log captures all mutations (SC-006)
