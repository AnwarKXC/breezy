-- Acting user for private.current_user_id(), scoped to the current transaction.
-- @param {String} $1:userId
SELECT set_config('app.user_id', $1, true) AS user_id
