create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(private.current_app_role() = 'admin'::public.app_role, false)
$$;

create or replace function private.can_read_logs()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_admin()
$$;

create or replace function private.can_read_bookings()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;

create or replace function private.can_write_bookings()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'front_desk'::public.app_role)
$$;

drop policy "profiles_select_own_or_admin" on public.profiles;
drop policy "profiles_insert_admin" on public.profiles;
drop policy "profiles_update_admin" on public.profiles;
drop policy "profiles_delete_admin" on public.profiles;
drop policy "audit_logs_insert_authenticated" on public.audit_logs;
drop policy "audit_logs_select_logs_readers" on public.audit_logs;
drop policy "bookings_select_staff" on public.bookings;
drop policy "bookings_insert_writers" on public.bookings;
drop policy "bookings_update_writers" on public.bookings;
drop policy "bookings_delete_writers" on public.bookings;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id or private.is_admin());

create policy "profiles_insert_admin"
on public.profiles
for insert
to authenticated
with check (private.is_admin());

create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "profiles_delete_admin"
on public.profiles
for delete
to authenticated
using (private.is_admin());

create policy "audit_logs_insert_authenticated_actor"
on public.audit_logs
for insert
to authenticated
with check (actor ->> 'id' = (select auth.uid())::text);

create policy "audit_logs_select_logs_readers"
on public.audit_logs
for select
to authenticated
using (private.can_read_logs());

create policy "bookings_select_staff"
on public.bookings
for select
to authenticated
using (private.can_read_bookings());

create policy "bookings_insert_writers"
on public.bookings
for insert
to authenticated
with check (private.can_write_bookings());

create policy "bookings_update_writers"
on public.bookings
for update
to authenticated
using (private.can_write_bookings())
with check (private.can_write_bookings());

create policy "bookings_delete_writers"
on public.bookings
for delete
to authenticated
using (private.can_write_bookings());

drop function public.can_read_bookings();
drop function public.can_read_logs();
drop function public.can_write_bookings();
drop function public.is_admin();
drop function public.current_app_role();
