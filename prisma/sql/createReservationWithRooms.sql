-- @param {String} $1:checkIn
-- @param {String} $2:checkOut
-- @param {String} $3:roomTypeCounts
-- @param {String} $4:contactId?
-- @param {String} $5:guestName
-- @param {String} $6:guestId?
-- @param {String} $7:createdBy
-- @param {String} $8:currency
SELECT public.create_reservation_with_rooms($1::date, $2::date, $3::jsonb, $4::uuid, $5::text, $6::uuid, $7::uuid, $8::text) AS result
