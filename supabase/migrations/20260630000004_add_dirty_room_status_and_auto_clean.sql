-- ============================================================
-- Migration: Add dirty room status and auto-clean timer
-- After checkout -> status = dirty (2 hour timer) -> status = available
-- ============================================================

alter type public.room_status add value 'dirty';

create or replace function public.auto_clean_dirty_rooms()
returns table(room_id uuid, old_status text, new_status text)
language plpgsql
security definer
as $$
declare
  r record;
  sys_user uuid;
begin
  select id into sys_user from public.profiles order by created_at asc limit 1;

  for r in
    update public.rooms
    set status = 'available', updated_at = now()
    where status = 'dirty'
      and updated_at <= now() - interval '2 hours'
    returning id, 'dirty'::text, 'available'::text
  loop
    insert into public.room_status_history (room_id, from_status, to_status, reason, changed_by, metadata)
    values (r.id, 'dirty', 'available', 'Auto-cleaned after 2-hour timer', sys_user, '{}'::jsonb);

    room_id := r.id;
    old_status := 'dirty';
    new_status := 'available';
    return next;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
