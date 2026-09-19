-- Function: auto_checkin_reservations()
-- Automatically checks in held reservations when their check-in date/time arrives.
-- Called by pg_cron every 5 minutes.

CREATE OR REPLACE FUNCTION public.auto_checkin_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_room_assignment RECORD;
  v_count integer := 0;
  v_now timestamptz := now();
BEGIN
  FOR v_reservation IN
    SELECT id, check_in_date, check_in_time
    FROM public.reservations
    WHERE status = 'held'
      AND check_in_date <= CURRENT_DATE
      AND (check_in_time IS NULL OR check_in_time <= CURRENT_TIME)
      AND deleted_at IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Update reservation status to checked_in
    UPDATE public.reservations
    SET status = 'checked_in',
        checked_in_at = v_now,
        updated_at = v_now
    WHERE id = v_reservation.id;

    -- Record reservation status history
    INSERT INTO public.reservation_status_history (reservation_id, from_status, to_status, changed_at)
    VALUES (v_reservation.id, 'held', 'checked_in', v_now);

    -- Update all non-cancelled room assignments to occupied
    UPDATE public.reservation_rooms
    SET status = 'occupied'::public.reservation_room_status,
        updated_at = v_now
    WHERE reservation_id = v_reservation.id
      AND status != 'cancelled'
      AND deleted_at IS NULL;

    -- Update physical rooms to occupied and record history
    FOR v_room_assignment IN
      SELECT rr.room_id, rr.status AS old_room_status
      FROM public.reservation_rooms rr
      WHERE rr.reservation_id = v_reservation.id
        AND rr.room_id IS NOT NULL
        AND rr.status != 'cancelled'
        AND rr.deleted_at IS NULL
    LOOP
      UPDATE public.rooms
      SET status = 'occupied'::public.room_status,
          updated_at = v_now
      WHERE id = v_room_assignment.room_id;

      INSERT INTO public.room_status_history (room_id, from_status, to_status, reservation_id, changed_at)
      VALUES (v_room_assignment.room_id, v_room_assignment.old_room_status, 'occupied', v_reservation.id, v_now);
    END LOOP;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Also clean up expired held reservations: automatically cancel them
CREATE OR REPLACE FUNCTION public.auto_expire_held_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_room_assignment RECORD;
  v_count integer := 0;
  v_now timestamptz := now();
BEGIN
  -- Cancel held reservations past their check-out date (they never checked in)
  FOR v_reservation IN
    SELECT id, check_in_date, check_out_date
    FROM public.reservations
    WHERE status = 'held'
      AND check_out_date < CURRENT_DATE
      AND deleted_at IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.reservations
    SET status = 'expired',
        updated_at = v_now
    WHERE id = v_reservation.id;

    INSERT INTO public.reservation_status_history (reservation_id, from_status, to_status, reason, changed_at)
    VALUES (v_reservation.id, 'held', 'expired', 'Auto-expired: check-out date passed without check-in', v_now);

    -- Free room assignments
    UPDATE public.reservation_rooms
    SET status = 'cancelled'::public.reservation_room_status,
        updated_at = v_now
    WHERE reservation_id = v_reservation.id
      AND deleted_at IS NULL;

    FOR v_room_assignment IN
      SELECT rr.room_id
      FROM public.reservation_rooms rr
      WHERE rr.reservation_id = v_reservation.id
        AND rr.room_id IS NOT NULL
        AND rr.deleted_at IS NULL
    LOOP
      INSERT INTO public.room_status_history (room_id, from_status, to_status, reservation_id, reason, changed_at)
      VALUES (v_room_assignment.room_id, 'held', 'available', v_reservation.id, 'Auto-expired reservation', v_now);
    END LOOP;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Schedule auto-checkin every 5 minutes, and auto-expiry every 30 minutes
SELECT cron.schedule('auto-checkin-every-5min', '*/5 * * * *', 'SELECT public.auto_checkin_reservations();');
SELECT cron.schedule('auto-expiry-every-30min', '*/30 * * * *', 'SELECT public.auto_expire_held_reservations();');
