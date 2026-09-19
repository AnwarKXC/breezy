-- Catalog verification for specs/004-supabase-schema-design
-- Run after `supabase migration up`.

-- T006: all reservation tables exist
select expected.table_name,
       (actual.table_name is not null) as exists
from (values
  ('reservations'),
  ('reservation_rooms'),
  ('reservation_guests'),
  ('reservation_company_info'),
  ('reservation_pricing_items'),
  ('reservation_payments'),
  ('reservation_holds'),
  ('reservation_notes'),
  ('reservation_status_history'),
  ('room_status_history')
) as expected(table_name)
left join information_schema.tables actual
  on actual.table_schema = 'public'
 and actual.table_name = expected.table_name
order by expected.table_name;

-- T007: all reservation enums exist
select expected.type_name,
       (actual.typname is not null) as exists
from (values
  ('reservation_status'),
  ('reservation_booking_type'),
  ('billing_party'),
  ('reservation_source'),
  ('reservation_room_status'),
  ('reservation_guest_role'),
  ('reservation_payment_type'),
  ('reservation_payment_method'),
  ('price_source'),
  ('room_physical_status')
) as expected(type_name)
left join pg_type actual
  on actual.typnamespace = 'public'::regnamespace
 and actual.typname = expected.type_name
order by expected.type_name;

-- T008: btree_gist installed
select extname, extnamespace::regnamespace as schema_name
from pg_extension
where extname = 'btree_gist';

-- T009/T034: RLS enabled on all reservation tables
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and (c.relname like 'reservation_%' or c.relname = 'room_status_history')
order by c.relname;

-- T012: exclusion constraint exists
select conname, contype, conrelid::regclass as table_name
from pg_constraint
where conname = 'reservation_rooms_no_overlap';

-- T013: single primary guest partial unique index exists
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'reservation_guests_single_primary';

-- T033/T035/T037: RPC/helper functions exist
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'can_read_reservations',
    'can_write_reservations',
    'can_override_pricing',
    'get_room_availability',
    'confirm_reservation',
    'cancel_reservation',
    'check_in_reservation',
    'check_out_reservation',
    'release_expired_holds'
  )
order by p.proname;

-- Data API grants: authenticated has table privileges; anon should not.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and (table_name like 'reservation_%' or table_name = 'room_status_history')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
