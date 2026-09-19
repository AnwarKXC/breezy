-- Add a trigger to validate reservation status transitions
-- Valid flows:
--   DRAFT      -> HELD, CONFIRMED, CANCELLED
--   HELD       -> CONFIRMED, EXPIRED, CANCELLED
--   CONFIRMED  -> CHECKED_IN, CANCELLED, NO_SHOW
--   CHECKED_IN -> CHECKED_OUT
--   Terminal: CHECKED_OUT, CANCELLED, NO_SHOW, EXPIRED, FAILED cannot transition

CREATE OR REPLACE FUNCTION public.check_reservation_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE OLD.status
      WHEN 'DRAFT' THEN
        IF NEW.status NOT IN ('HELD', 'CONFIRMED', 'CANCELLED') THEN
          RAISE EXCEPTION 'Invalid status transition from DRAFT to %', NEW.status;
        END IF;
      WHEN 'HELD' THEN
        IF NEW.status NOT IN ('CONFIRMED', 'EXPIRED', 'CANCELLED') THEN
          RAISE EXCEPTION 'Invalid status transition from HELD to %', NEW.status;
        END IF;
      WHEN 'CONFIRMED' THEN
        IF NEW.status NOT IN ('CHECKED_IN', 'CANCELLED', 'NO_SHOW') THEN
          RAISE EXCEPTION 'Invalid status transition from CONFIRMED to %', NEW.status;
        END IF;
      WHEN 'CHECKED_IN' THEN
        IF NEW.status != 'CHECKED_OUT' THEN
          RAISE EXCEPTION 'Invalid status transition from CHECKED_IN to %', NEW.status;
        END IF;
      WHEN 'CHECKED_OUT' THEN
        RAISE EXCEPTION 'Cannot transition from terminal status CHECKED_OUT';
      WHEN 'CANCELLED' THEN
        RAISE EXCEPTION 'Cannot transition from terminal status CANCELLED';
      WHEN 'NO_SHOW' THEN
        RAISE EXCEPTION 'Cannot transition from terminal status NO_SHOW';
      WHEN 'EXPIRED' THEN
        RAISE EXCEPTION 'Cannot transition from terminal status EXPIRED';
      WHEN 'FAILED' THEN
        RAISE EXCEPTION 'Cannot transition from terminal status FAILED';
      ELSE
        RAISE EXCEPTION 'Unknown reservation status: %', OLD.status;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reservation_status_transition
  BEFORE UPDATE OF status ON public.reservations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.check_reservation_status_transition();
