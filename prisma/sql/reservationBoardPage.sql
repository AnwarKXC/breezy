-- One page of reservation ids for the reservations list, filtered and ordered
-- server-side, plus the total match count (returned even when the page is empty;
-- then `id` is null).
-- Order: checked in, then upcoming (draft/held/confirmed/...), checked out,
-- cancelled; nearest check-in first within each group.
-- @param {String} $1:search? ILIKE pattern, already escaped and wrapped in %
-- @param {String} $2:from? stays ending on/after this date
-- @param {String} $3:to? stays starting on/before this date
-- @param {String} $4:statuses? comma-separated reservation_status values
-- @param {String} $5:guestType? 'company' | 'individual'
-- @param {Int} $6:limit
-- @param {Int} $7:offset
WITH filtered AS (
  SELECT r.id, r.status, r.check_in_date
  FROM public.reservations r
  WHERE r.deleted_at IS NULL
    AND ($2::date IS NULL OR r.check_out_date >= $2::date)
    AND ($3::date IS NULL OR r.check_in_date <= $3::date)
    AND ($4::text IS NULL OR r.status::text = ANY (string_to_array($4::text, ',')))
    AND (
      $5::text IS NULL
      OR ($5::text = 'company') = (
        r.company_id IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM public.reservation_company_info ci
          WHERE ci.reservation_id = r.id AND ci.company_name IS NOT NULL
        )
      )
    )
    AND (
      $1::text IS NULL
      OR r.booker_name ILIKE $1::text
      OR EXISTS (
        SELECT 1 FROM public.reservation_guests g
        WHERE g.reservation_id = r.id AND g.deleted_at IS NULL AND g.full_name ILIKE $1::text
      )
      OR EXISTS (
        SELECT 1 FROM public.reservation_company_info ci
        WHERE ci.reservation_id = r.id AND ci.company_name ILIKE $1::text
      )
      OR EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = r.company_id AND c.name ILIKE $1::text
      )
      OR EXISTS (
        SELECT 1 FROM public.reservation_rooms rr
        JOIN public.rooms rm ON rm.id = rr.room_id
        WHERE rr.reservation_id = r.id AND rr.deleted_at IS NULL AND rm.number ILIKE $1::text
      )
    )
)
SELECT page.id, totals.total
FROM (SELECT count(*)::int AS total FROM filtered) totals
LEFT JOIN LATERAL (
  SELECT f.id
  FROM filtered f
  ORDER BY
    CASE f.status
      WHEN 'checked_in' THEN 0
      WHEN 'checked_out' THEN 2
      WHEN 'cancelled' THEN 3
      ELSE 1
    END,
    f.check_in_date,
    f.id
  LIMIT $6::int OFFSET $7::int
) page ON true
