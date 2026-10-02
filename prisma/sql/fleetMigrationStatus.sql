-- Migration state reported to the control plane (GET /api/system/health).
SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS applied,
       count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS failed,
       max(migration_name) FILTER (WHERE finished_at IS NOT NULL) AS latest
FROM _prisma_migrations
