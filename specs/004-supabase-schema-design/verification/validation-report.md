# Schema Design Validation Report

Feature: `004-supabase-schema-design`
Date: 2026-06-28

## Tool Status

- Supabase CLI: available through `npx -y supabase --version` -> `2.108.0`.
- Local Supabase stack: blocked. `npx -y supabase start` fails because Docker Desktop Linux engine pipe is missing.
- Supabase MCP: not exposed in this Codex session; no `execute_sql` tool available.
- `psql`: not installed on PATH.

## Commands Run

```text
npx -y supabase --version
# 2.108.0

npx -y supabase start
# failed to inspect service: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.

npx -y supabase migration list --local
# failed to connect to postgres: dial tcp 127.0.0.1:54322: connectex: No connection could be made because the target machine actively refused it.
```

## Static Validation Passed

- 10/10 reservation tables present in migration SQL.
- 10/10 reservation enums present in migration SQL.
- 10/10 reservation tables have RLS enabled in migration SQL.
- 10/10 reservation tables have explicit authenticated grants.
- 3/3 RPCs in `20260628000001_create_reservation_model.sql` present.
- 3/3 RPCs in `20260628000002_reservation_rpcs.sql` present.
- `reservation_guests.deleted_at` added so `reservation_guests_single_primary` partial index is valid.
- RLS helper functions now call `private.current_app_role()` and `private.is_admin()`, matching prior hardening migration.
- pg_cron nested dollar-quote fixed with `$cron$`.
- Quickstart RLS query corrected to use `pg_class.relrowsecurity`.

## Files Added For Live Verification

- `specs/004-supabase-schema-design/verification/catalog-checks.sql`
- `specs/004-supabase-schema-design/verification/data-smoke-tests.sql`

## Live Verification Blocked

Tasks requiring a running local Supabase/Postgres instance remain blocked until Docker Desktop is running or a remote Supabase connection/MCP is available:

- `supabase start`
- `supabase migration up`
- catalog queries against the applied DB
- data/RPC smoke tests
- full quickstart end-to-end run

## Next Step

Start Docker Desktop, then run:

```powershell
npx -y supabase start
npx -y supabase migration up
npx -y supabase db query --file specs/004-supabase-schema-design/verification/catalog-checks.sql
npx -y supabase db query --file specs/004-supabase-schema-design/verification/data-smoke-tests.sql
```
