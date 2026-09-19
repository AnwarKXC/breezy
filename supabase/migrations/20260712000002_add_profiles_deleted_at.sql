-- Add soft-delete column to profiles table
ALTER TABLE public.profiles ADD COLUMN deleted_at timestamptz;
