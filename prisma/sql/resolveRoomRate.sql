-- Nightly rate for one room and stay (see public.resolve_room_rate).
-- @param {String} $1:roomId
-- @param {String} $2:checkIn
-- @param {String} $3:checkOut
-- @param {String} $4:contactId?
-- @param {String} $5:occupancyCode?
SELECT rate, source::text AS source
FROM public.resolve_room_rate($1::uuid, $2::date, $3::date, $4::uuid, $5::occupancy_code)
