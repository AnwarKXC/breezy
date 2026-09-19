-- @param {String} $1:roomId
-- @param {String} $2:checkIn
-- @param {String} $3:checkOut
-- @param {String} $4:reservationId?
-- @param {Int} $5:holdDurationMinutes
SELECT public.create_reservation_hold($1::uuid, $2::date, $3::date, $4::uuid, $5::int) AS result
