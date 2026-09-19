-- Every room with availability and resolved prices for a stay.
-- @param {String} $1:checkIn
-- @param {String} $2:checkOut
-- @param {String} $3:roomTypeId?
-- @param {Int} $4:capacity?
-- @param {String} $5:contactId?
-- @param {String} $6:excludeReservationId?
SELECT *
FROM public.get_room_availability($1::date, $2::date, $3::uuid, $4::int, $5::uuid, $6::uuid)
