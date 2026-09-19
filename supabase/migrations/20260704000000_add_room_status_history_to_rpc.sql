-- ============================================================
-- Migration: Add room_status_history writes to reservation RPC
-- Purpose: Record booking events in each room's history timeline
-- ============================================================

create or replace function public.create_reservation_with_rooms(
  p_check_in date,
  p_check_out date,
  p_room_type_counts jsonb,
  p_contact_id uuid default null,
  p_guest_name text default '',
  p_guest_id uuid default null,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_reservation_id uuid;
  v_selected_rooms jsonb := '[]'::jsonb;
  v_room_record record;
  v_requested jsonb;
  v_room_type_id uuid;
  v_count int;
  v_got int;
  v_insufficient jsonb := '[]'::jsonb;
  v_nights int;
  v_total_amount numeric(12,2) := 0;
  v_created_reservation_room_id uuid;
  v_primary_reservation_room_id uuid;
  v_current_room_status text;
begin
  -- Validate dates
  if p_check_in >= p_check_out then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'check_in must be before check_out')
    );
  end if;

  v_nights := p_check_out - p_check_in;

  -- Validate room_type_counts
  if jsonb_typeof(p_room_type_counts) != 'array' or jsonb_array_length(p_room_type_counts) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'At least one room type must be specified')
    );
  end if;

  -- Serialize assignment per room type to avoid double-selecting the same rooms under concurrency
  for v_requested in
    select value
    from jsonb_array_elements(p_room_type_counts) as counts(value)
    order by value->>'roomTypeId'
  loop
    v_room_type_id := (v_requested->>'roomTypeId')::uuid;
    v_count := (v_requested->>'count')::int;

    if v_count < 0 then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Room count must be non-negative')
      );
    end if;

    if v_count = 0 then continue; end if;

    perform pg_advisory_xact_lock(hashtextextended('reservation-room-type:' || v_room_type_id::text, 0));

    v_got := 0;
    for v_room_record in
      select rm.id, rm.number, rm.price
      from public.rooms rm
      where rm.room_type_id = v_room_type_id
        and rm.status::text != 'maintenance'
        and rm.deleted_at is null
        and not exists (
          select 1
          from public.reservation_rooms rr
          join public.reservations r on r.id = rr.reservation_id
          where rr.room_id = rm.id
            and rr.status::text not in ('cancelled', 'released')
            and r.status::text not in ('cancelled', 'expired', 'no_show', 'checked_out')
            and r.check_in_date < p_check_out
            and r.check_out_date > p_check_in
        )
        and not exists (
          select 1
          from public.reservation_holds rh
          where rh.room_id = rm.id
            and rh.status = 'active'
            and rh.expires_at > now()
            and rh.check_in_date < p_check_out
            and rh.check_out_date > p_check_in
        )
      order by rm.number
      limit v_count
    loop
      v_selected_rooms := v_selected_rooms || jsonb_build_object(
        'roomId', v_room_record.id,
        'roomNumber', v_room_record.number,
        'roomTypeId', v_room_type_id,
        'nightlyRate', v_room_record.price
      );
      v_got := v_got + 1;
      v_total_amount := v_total_amount + (v_room_record.price * v_nights);
    end loop;

    if v_got < v_count then
      v_insufficient := v_insufficient || jsonb_build_object(
        'roomTypeId', v_room_type_id,
        'requested', v_count,
        'got', v_got
      );
    end if;
  end loop;

  -- If any types had insufficient rooms, return error
  if jsonb_array_length(v_insufficient) > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'ROOM_UNAVAILABLE',
        'message', 'Some room types do not have enough available rooms for the requested dates',
        'details', jsonb_build_object('availability', v_insufficient)
      )
    );
  end if;

  -- Create reservation in DRAFT status
  insert into public.reservations (
    status, booking_type, source, currency,
    check_in_date, check_out_date, nights, total_amount, paid_amount,
    balance_amount, room_count, created_by
  ) values (
    'draft'::reservation_status,
    'individual'::reservation_booking_type,
    'manual'::reservation_source,
    'EGP',
    p_check_in, p_check_out, v_nights, v_total_amount, 0,
    v_total_amount, jsonb_array_length(v_selected_rooms), p_created_by
  )
  returning id into v_reservation_id;

  -- Create reservation_rooms entries + room_status_history entries
  for v_room_record in select * from jsonb_array_elements(v_selected_rooms)
  loop
    insert into public.reservation_rooms (
      reservation_id, room_id, room_type_id,
      status, rate_per_night, nights, total_amount,
      check_in_date, check_out_date
    ) values (
      v_reservation_id,
      (v_room_record.value->>'roomId')::uuid,
      (v_room_record.value->>'roomTypeId')::uuid,
      'reserved'::reservation_room_status,
      (v_room_record.value->>'nightlyRate')::numeric,
      v_nights, (v_room_record.value->>'nightlyRate')::numeric * v_nights,
      p_check_in, p_check_out
    )
    returning id into v_created_reservation_room_id;

    -- Record room status history so the room's timeline shows the booking event
    v_current_room_status := (select status::text from public.rooms where id = (v_room_record.value->>'roomId')::uuid);
    insert into public.room_status_history (
      room_id, from_status, to_status, reason, reservation_id, changed_by, changed_at, metadata
    ) values (
      (v_room_record.value->>'roomId')::uuid,
      v_current_room_status,
      v_current_room_status,
      'Reservation created',
      v_reservation_id, p_created_by, now(), '{}'::jsonb
    );

    if v_primary_reservation_room_id is null then
      v_primary_reservation_room_id := v_created_reservation_room_id;
    end if;
  end loop;

  -- Record reservation status history
  insert into public.reservation_status_history (
    reservation_id, from_status, to_status, changed_by, changed_at
  ) values (
    v_reservation_id, null, 'draft', p_created_by, now()
  );

  -- Insert primary guest if name provided
  if p_guest_name != '' then
    insert into public.reservation_guests (
      reservation_id, reservation_room_id, role, full_name,
      is_primary, is_vip, guest_id, created_at, updated_at
    ) values (
      v_reservation_id, v_primary_reservation_room_id,
      'primary_guest'::reservation_guest_role,
      p_guest_name, true, false,
      p_guest_id, now(), now()
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'reservationId', v_reservation_id,
      'rooms', v_selected_rooms
    )
  );
end;
$$;

notify pgrst, 'reload schema';
