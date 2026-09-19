-- ============================================================
-- Migration: Add availability RPC and hold management RPCs
-- Covers scenarios: B01-B11, C01-C05
-- ============================================================

-- ============================================================
-- 1. get_room_availability: Core availability RPC
-- ============================================================

create or replace function public.get_room_availability(
  p_check_in date,
  p_check_out date,
  p_room_type_id uuid default null,
  p_capacity int default null,
  p_contact_id uuid default null,
  p_exclude_reservation_id uuid default null
)
returns table (
  room_id uuid,
  room_number text,
  floor int,
  room_type_id uuid,
  room_type_name text,
  capacity int,
  amenities jsonb,
  status text,
  reason text,
  base_price numeric(10,2),
  effective_price numeric(10,2),
  price_source text,
  currency text
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_nights int := p_check_out - p_check_in;
begin
  if p_check_in >= p_check_out then
    return;
  end if;

  return query
  with booked_room_ids as (
    select distinct rr.room_id
    from public.reservation_rooms rr
    join public.reservations r on r.id = rr.reservation_id
    where rr.room_id is not null
      and rr.assignment_state != 'cancelled'
      and r.status not in ('CANCELLED', 'EXPIRED', 'FAILED')
      and (p_exclude_reservation_id is null or r.id != p_exclude_reservation_id)
      and exists (
        select 1 from public.reservation_rooms rr2
        join public.reservations r2 on r2.id = rr2.reservation_id
        where rr2.room_id = rr.room_id
          and r2.check_in < p_check_out
          and r2.check_out > p_check_in
          and r2.status not in ('CANCELLED', 'EXPIRED', 'FAILED')
          and (p_exclude_reservation_id is null or r2.id != p_exclude_reservation_id)
      )
  ),
  held_room_ids as (
    select distinct rh.room_id
    from public.reservation_holds rh
    where rh.room_id is not null
      and rh.action = 'created'
      and rh.expires_at > now()
      and rh.check_in < p_check_out
      and rh.check_out > p_check_in
      and (p_exclude_reservation_id is null or rh.reservation_id != p_exclude_reservation_id)
  ),
  unavailable_room_ids as (
    select room_id from booked_room_ids
    union
    select room_id from held_room_ids
    union
    select id from public.rooms where status in ('maintenance')
  ),
  company_rate as (
    select
      cpo.price,
      cpo.room_category
    from public.company_price_overrides cpo
    where cpo.contact_id = p_contact_id
      and cpo.deleted_at is null
  ),
  seasonal_rate as (
    select
      rtp.price,
      rtp.room_type_id
    from public.room_type_pricing rtp
    where rtp.effective_from <= p_check_in
      and (rtp.effective_until is null or rtp.effective_until >= p_check_out)
      and rtp.deleted_at is null
  )
  select
    rm.id,
    rm.number,
    rm.floor,
    rt.id,
    rt.name,
    rm.capacity,
    rm.amenities,
    case
      when rm.status = 'maintenance' then 'unavailable'
      when ua.room_id is not null then 'unavailable'
      when exists (select 1 from held_room_ids h where h.room_id = rm.id) then 'unavailable'
      when exists (select 1 from booked_room_ids b where b.room_id = rm.id) then 'unavailable'
      else 'available'
    end::text,
    case
      when rm.status = 'maintenance' then 'maintenance'
      when exists (select 1 from held_room_ids h where h.room_id = rm.id) then 'held'
      when exists (select 1 from booked_room_ids b where b.room_id = rm.id) then 'booked'
      else null
    end::text,
    rm.price,
    coalesce(
      (select cr.price from company_rate cr where cr.room_category = rt.slug),
      (select sr.price from seasonal_rate sr where sr.room_type_id = rt.id),
      rm.price
    ),
    case
      when exists (select 1 from company_rate cr where cr.room_category = rt.slug) then 'company_override'
      when exists (select 1 from seasonal_rate sr where sr.room_type_id = rt.id) then 'seasonal'
      else 'standard'
    end::text,
    'EGP'
  from public.rooms rm
  join public.room_types rt on rt.id = rm.room_type_id
  left join unavailable_room_ids ua on ua.room_id = rm.id
  where rm.deleted_at is null
    and (p_room_type_id is null or rm.room_type_id = p_room_type_id)
    and (p_capacity is null or rm.capacity >= p_capacity)
  order by rm.number;
end;
$$;

-- ============================================================
-- 2. create_reservation_hold: Create hold with conflict detection
-- ============================================================

create or replace function public.create_reservation_hold(
  p_room_id uuid,
  p_check_in date,
  p_check_out date,
  p_reservation_id uuid default null,
  p_hold_duration_minutes int default 15
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_expires_at timestamptz;
  v_has_conflict boolean;
  v_hold_id uuid;
  v_reservation_id uuid;
begin
  -- Validate dates
  if p_check_in >= p_check_out then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'check_in must be before check_out'));
  end if;

  -- Lock the room row to prevent concurrent holds
  perform 1 from public.rooms where id = p_room_id for update nowait;

  -- Check for active overlapping holds
  select exists (
    select 1
    from public.reservation_holds rh
    where rh.room_id = p_room_id
      and rh.action = 'created'
      and rh.expires_at > now()
      and rh.check_in < p_check_out
      and rh.check_out > p_check_in
      and (p_reservation_id is null or rh.reservation_id != p_reservation_id)
  ) into v_has_conflict;

  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'HOLD_CONFLICT', 'message', 'Room is already held for the requested dates'));
  end if;

  -- Check for existing confirmed reservations
  select exists (
    select 1
    from public.reservation_rooms rr
    join public.reservations r on r.id = rr.reservation_id
    where rr.room_id = p_room_id
      and rr.assignment_state != 'cancelled'
      and r.status not in ('CANCELLED', 'EXPIRED', 'FAILED', 'CHECKED_OUT')
      and (p_reservation_id is null or r.id != p_reservation_id)
      and r.check_in < p_check_out
      and r.check_out > p_check_in
  ) into v_has_conflict;

  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'ROOM_UNAVAILABLE', 'message', 'Room is already booked for the requested dates'));
  end if;

  -- Create or use existing reservation
  if p_reservation_id is null then
    insert into public.reservations (status, check_in, check_out, total_amount, paid_amount, balance)
    values ('HELD', p_check_in, p_check_out, 0, 0, 0)
    returning id into v_reservation_id;
  else
    v_reservation_id := p_reservation_id;
  end if;

  -- Calculate expiry
  v_expires_at := now() + (p_hold_duration_minutes || ' minutes')::interval;

  -- Create hold
  insert into public.reservation_holds (reservation_id, room_id, check_in, check_out, expires_at)
  values (v_reservation_id, p_room_id, p_check_in, p_check_out, v_expires_at)
  returning id into v_hold_id;

  -- Update reservation status to HELD if DRAFT
  update public.reservations
  set status = 'HELD',
      check_in = p_check_in,
      check_out = p_check_out
  where id = v_reservation_id and status = 'DRAFT';

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'hold_id', v_hold_id,
      'reservation_id', v_reservation_id,
      'expires_at', v_expires_at
    )
  );
end;
$$;

-- ============================================================
-- 3. release_reservation_hold: Manually release a hold
-- ============================================================

create or replace function public.release_reservation_hold(
  p_hold_id uuid,
  p_reservation_status text default 'CANCELLED'
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_reservation_id uuid;
  v_room_id uuid;
begin
  select reservation_id, room_id into v_reservation_id, v_room_id
  from public.reservation_holds
  where id = p_hold_id and action = 'created';

  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Active hold not found'));
  end if;

  -- Mark hold as released
  update public.reservation_holds
  set action = 'released', released_at = now()
  where id = p_hold_id;

  -- Update reservation status
  update public.reservations
  set status = p_reservation_status::public.reservation_status
  where id = v_reservation_id and status in ('DRAFT', 'HELD');

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('hold_id', p_hold_id, 'reservation_id', v_reservation_id));
end;
$$;

-- ============================================================
-- 4. expire_reservation_holds: Bulk expire stale holds
-- ============================================================

create or replace function public.expire_reservation_holds()
returns table (
  hold_id uuid,
  reservation_id uuid,
  expired_at timestamptz
)
language plpgsql
set search_path = public
as $$
begin
  return query
  with expired as (
    update public.reservation_holds
    set action = 'expired'
    where action = 'created' and expires_at <= now()
    returning id, reservation_id
  ),
  updated_reservations as (
    update public.reservations r
    set status = 'EXPIRED'
    from expired e
    where r.id = e.reservation_id and r.status = 'HELD'
  )
  select e.id, e.reservation_id, now()
  from expired e;
end;
$$;

-- ============================================================
-- 5. confirm_reservation_from_hold: Convert hold to confirmed
-- ============================================================

create or replace function public.confirm_reservation_from_hold(
  p_reservation_id uuid,
  p_confirmed_by uuid default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_check_in date;
  v_check_out date;
  v_has_conflict boolean;
  v_confirmation text;
begin
  -- Lock reservation row
  select check_in, check_out, confirmation_number into v_check_in, v_check_out, v_confirmation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Reservation not found'));
  end if;

  -- Re-check availability for all held rooms
  select exists (
    select 1
    from public.reservation_holds rh
    join public.reservation_rooms rr on rr.reservation_id = rh.reservation_id and rr.room_id = rh.room_id
    where rh.reservation_id = p_reservation_id and rh.action = 'created'
      and exists (
        select 1 from public.reservation_rooms rr2
        join public.reservations r2 on r2.id = rr2.reservation_id
        where rr2.room_id = rh.room_id
          and r2.id != p_reservation_id
          and r2.status not in ('CANCELLED', 'EXPIRED', 'FAILED', 'CHECKED_OUT')
          and r2.check_in < rh.check_out
          and r2.check_out > rh.check_in
      )
  ) into v_has_conflict;

  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'ROOM_UNAVAILABLE', 'message', 'One or more rooms are no longer available'));
  end if;

  -- Generate confirmation number
  v_confirmation := public.generate_confirmation_number();

  -- Update reservation
  update public.reservations
  set status = 'CONFIRMED',
      confirmation_number = v_confirmation,
      updated_by = p_confirmed_by
  where id = p_reservation_id;

  -- Update room assignments
  update public.reservation_rooms
  set assignment_state = 'assigned', assigned_at = now()
  where reservation_id = p_reservation_id and assignment_state = 'assigned';

  -- Mark holds as consumed
  update public.reservation_holds
  set action = 'consumed'
  where reservation_id = p_reservation_id and action = 'created';

  -- Record status history
  insert into public.reservation_status_history (reservation_id, old_status, new_status, changed_by)
  values (p_reservation_id, 'HELD', 'CONFIRMED', p_confirmed_by);

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'reservation_id', p_reservation_id,
      'confirmation_number', v_confirmation
    )
  );
end;
$$;

-- ============================================================
-- 6. confirm_reservation: Confirm draft reservation without hold
-- ============================================================

create or replace function public.confirm_reservation(
  p_reservation_id uuid,
  p_confirmed_by uuid default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_check_in date;
  v_check_out date;
  v_has_conflict boolean;
  v_confirmation text;
begin
  select check_in, check_out, confirmation_number into v_check_in, v_check_out, v_confirmation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Reservation not found'));
  end if;

  -- Check for conflicting reservations on assigned rooms
  select exists (
    select 1
    from public.reservation_rooms rr
    where rr.reservation_id = p_reservation_id
      and rr.room_id is not null
      and rr.assignment_state != 'cancelled'
      and exists (
        select 1 from public.reservation_rooms rr2
        join public.reservations r2 on r2.id = rr2.reservation_id
        where rr2.room_id = rr.room_id
          and rr2.reservation_id != p_reservation_id
          and r2.id != p_reservation_id
          and r2.status not in ('CANCELLED', 'EXPIRED', 'FAILED', 'CHECKED_OUT')
          and r2.check_in < v_check_out
          and r2.check_out > v_check_in
      )
  ) into v_has_conflict;

  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'ROOM_UNAVAILABLE', 'message', 'One or more rooms are no longer available'));
  end if;

  v_confirmation := public.generate_confirmation_number();

  update public.reservations
  set status = 'CONFIRMED',
      confirmation_number = v_confirmation,
      updated_by = p_confirmed_by
  where id = p_reservation_id;

  insert into public.reservation_status_history (reservation_id, old_status, new_status, changed_by)
  values (p_reservation_id, 'DRAFT', 'CONFIRMED', p_confirmed_by);

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'reservation_id', p_reservation_id,
      'confirmation_number', v_confirmation
    )
  );
end;
$$;

notify pgrst, 'reload schema';
