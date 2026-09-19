-- Function: auto_cancel_missed_checkin()
-- Cancels draft/held/confirmed reservations whose check-in date has passed.
-- Uses Egypt timezone (Africa/Cairo) for date comparison.
-- Called by pg_cron at 21:00, 22:00, 23:00 UTC to cover midnight Egypt
-- regardless of DST (UTC+2 or UTC+3).

CREATE OR REPLACE FUNCTION public.auto_cancel_missed_checkin()
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
  v_egypt_date date := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo')::date;
  v_system_user_id uuid := 'e73d7512-15fb-45fc-a0a8-cf1d13e76974';
BEGIN
  FOR v_reservation IN
    SELECT id, status
    FROM public.reservations
    WHERE status IN ('draft', 'held', 'confirmed')
      AND check_in_date < v_egypt_date
      AND deleted_at IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.reservations
    SET status = 'cancelled',
        cancelled_at = v_now,
        updated_at = v_now
    WHERE id = v_reservation.id;

    INSERT INTO public.reservation_status_history
      (reservation_id, from_status, to_status, reason, changed_by, changed_at)
    VALUES
      (v_reservation.id, v_reservation.status, 'cancelled', 'auto_cancelled_missed_checkin', v_system_user_id, v_now);

    UPDATE public.reservation_rooms
    SET status = 'cancelled'::public.reservation_room_status,
        updated_at = v_now
    WHERE reservation_id = v_reservation.id
      AND status NOT IN ('cancelled', 'checked_out')
      AND deleted_at IS NULL;

    FOR v_room_assignment IN
      SELECT rr.room_id, rr.status AS old_status
      FROM public.reservation_rooms rr
      WHERE rr.reservation_id = v_reservation.id
        AND rr.room_id IS NOT NULL
        AND rr.deleted_at IS NULL
    LOOP
      INSERT INTO public.room_status_history (room_id, from_status, to_status, reservation_id, reason, changed_by, changed_at)
      VALUES (v_room_assignment.room_id, v_room_assignment.old_status, 'available', v_reservation.id, 'auto_cancelled_missed_checkin', v_system_user_id, v_now);
    END LOOP;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

SELECT cron.schedule(
  'auto-cancel-missed-checkin',
  '0 21,22,23 * * *',
  'SELECT public.auto_cancel_missed_checkin();'
);
