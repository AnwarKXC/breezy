-- Bootstrap the first admin profile from a trusted service-role/admin context.
--
-- Required psql variables:
--   auth_user_id          Supabase auth.users.id for the admin user
--   email                 Admin email
--   name                  Admin display name
--
-- Optional psql variables:
--   phone                 Admin phone, or an empty string
--   external_firebase_id  Original Firebase user/document ID, or an empty string
--
-- Example:
--   psql "$DATABASE_URL" \
--     -v auth_user_id="00000000-0000-0000-0000-000000000000" \
--     -v email="admin@example.com" \
--     -v name="Hotel Admin" \
--     -v phone="" \
--     -v external_firebase_id="firebase-admin-uid" \
--     -f scripts/migrate-firebase-to-supabase/bootstrap-admin-profile.sql

\if :{?phone}
\else
\set phone ''
\endif

\if :{?external_firebase_id}
\else
\set external_firebase_id ''
\endif

begin;

insert into public.profiles (
  id,
  external_firebase_id,
  name,
  email,
  phone,
  role
)
values (
  :'auth_user_id'::uuid,
  nullif(:'external_firebase_id', ''),
  :'name',
  lower(:'email'),
  nullif(:'phone', ''),
  'admin'::public.app_role
)
on conflict (id) do update
set
  external_firebase_id = excluded.external_firebase_id,
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone,
  role = 'admin'::public.app_role,
  updated_at = now()
returning id, external_firebase_id, name, email, phone, role, created_at, updated_at;

commit;
