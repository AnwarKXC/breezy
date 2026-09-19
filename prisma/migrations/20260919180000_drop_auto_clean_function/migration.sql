-- Auto-clean now runs in the app (src/app/api/rooms/auto-clean/route.ts) with Prisma.
DROP FUNCTION IF EXISTS public.auto_clean_dirty_rooms();
