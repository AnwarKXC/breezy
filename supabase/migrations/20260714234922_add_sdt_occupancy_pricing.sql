-- Add occupancy-specific pricing columns to room_type_pricing
ALTER TABLE public.room_type_pricing
ADD COLUMN IF NOT EXISTS price_single numeric,
ADD COLUMN IF NOT EXISTS price_double numeric,
ADD COLUMN IF NOT EXISTS price_triple numeric;
