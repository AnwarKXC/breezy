-- Add missing DELETE policy for reservation_guests table
-- Company reservations need to remove the dummy guest inserted by the RPC

CREATE POLICY "reservation_guests_delete_writers" ON "public"."reservation_guests"
  FOR DELETE
  TO "authenticated"
  USING (can_write_reservations());
