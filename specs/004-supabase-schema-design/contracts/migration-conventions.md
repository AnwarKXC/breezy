# Migration Conventions

## Naming

Each migration file follows the format: `{timestamp}_{description}.sql`

Timestamp format: `YYYYMMDDHHMMSS` (e.g., `20260628000001`)

Description: Snake_case, concise, describes the change.

Examples:
- `20260628000001_create_reservation_model.sql`
- `20260629000001_add_reservation_active_function.sql`

## Approach

The initial reservation schema was created as a **single comprehensive migration** (`20260628000001_create_reservation_model.sql`) containing:
- All table DDL (9 reservation tables + room_status_history)
- All enums
- All indexes
- All RLS policies
- All RPC functions (availability, confirm, cancel)

**Future migrations should be smaller and focused** — one file per logical change:
- One table modification per file
- One function addition per file
- Index additions grouped when they serve a single purpose

## Content Standards

- Each migration is idiomatic SQL (not Supabase-specific syntax)
- All DDL wrapped in a transaction block (BEGIN/COMMIT)
- `CREATE TABLE IF NOT EXISTS` for idempotency
- `ALTER TYPE ... ADD VALUE IF NOT EXISTS` for enum additions
- Soft delete support via `deleted_at timestamptz` column on core tables
- UUID primary keys with `gen_random_uuid()` default
- UUID foreign keys with explicit `ON DELETE` behavior
- Constraints defined inline or as alter table statements
- No data seeds in migration files (use Supabase service-role client)
- Down migrations are not required (use Supabase CLI rollback)

## RLS Standards

- Enable RLS on every table AFTER creation
- Policy naming: `{table}_{operation}_{role}` (e.g., `reservations_select_staff`)
- Base policies on application_role derived from JWT
- Use helper functions (`can_read_reservations`, `can_write_reservations`, `can_override_pricing`) for consistent policy logic
- Default-deny — no `USING (true)` on any table
