-- Replace the create_reservation_hold function with corrected column names
-- The function previously referenced non-existent columns: held_by_user_id, check_in_date, check_out_date, status
-- Correct columns: check_in, check_out, action

CREATE OR REPLACE FUNCTION public.create_reservation_hold(
  p_room_id uuid,
  p_check_in date,
  p_check_out date,
  p_reservation_id uuid DEFAULT NULL,
  p_hold_duration_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Permission guard
  IF NOT public.can_write_reservations() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Check for conflicting holds
  IF EXISTS (
    SELECT 1 FROM public.reservation_holds rh
    WHERE rh.room_id = p_room_id
      AND rh.action = 'created'
      AND rh.expires_at > now()
      AND rh.check_in < p_check_out
      AND rh.check_out > p_check_in
      AND (p_reservation_id IS NULL OR rh.reservation_id != p_reservation_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is already held for this period', 'code', 'HOLD_CONFLICT');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reservation_rooms rr
    JOIN public.reservations r ON r.id = rr.reservation_id
    WHERE rr.room_id = p_room_id
      AND rr.status != 'cancelled'
      AND r.status NOT IN ('cancelled', 'expired', 'checked_out')
      AND r.deleted_at IS NULL
      AND r.check_in < p_check_out
      AND r.check_out > p_check_in
      AND (p_reservation_id IS NULL OR r.id != p_reservation_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is already booked for this period', 'code', 'BOOKING_CONFLICT');
  END IF;

  -- Check room not in maintenance
  IF EXISTS (SELECT 1 FROM public.rooms WHERE id = p_room_id AND status = 'maintenance') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is under maintenance', 'code', 'ROOM_MAINTENANCE');
  END IF;

  v_expires_at := now() + (p_hold_duration_minutes || ' minutes')::interval;

  INSERT INTO public.reservation_holds (
    reservation_id, room_id,
    check_in, check_out,
    action, expires_at
  ) VALUES (
    p_reservation_id, p_room_id,
    p_check_in, p_check_out,
    'created', v_expires_at
  )
  RETURNING id INTO v_hold_id;

  RETURN jsonb_build_object(
    'success', true,
    'hold_id', v_hold_id,
    'room_id', p_room_id,
    'expires_at', v_expires_at
  );
END;
$$;
