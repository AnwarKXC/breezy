-- Serializes plan-limit-checked inserts (rooms, users) inside one transaction, so two
-- concurrent creates cannot both pass a "count < limit" check. Released at commit.
-- @param {String} $1:scope
SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))
