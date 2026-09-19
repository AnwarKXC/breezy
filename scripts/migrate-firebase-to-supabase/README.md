# Firebase to Supabase Migration Utilities

Status: Phase 9 data migration scripts. These utilities do not delete Firebase code or remove
Firebase dependencies.

## Service Role Boundary

The SQL files in this directory are for controlled server-side or migration-only execution. They are intentionally not client-side scripts.

Use them only from:

- A trusted migration runner with Supabase service role credentials.
- A secure database connection used by an operator.
- Supabase MCP or SQL editor access controlled by project administrators.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser, public env vars, logs, screenshots, or committed files.

## First Admin Bootstrap

`bootstrap-admin-profile.sql` exists because profile writes are admin-only under RLS, and the first admin profile cannot be created through a normal user-scoped client until an admin profile already exists.

Expected flow:

1. Create or import the admin user in Supabase Auth.
2. Run `bootstrap-admin-profile.sql` from a trusted service-role/admin context.
3. Confirm the row exists in `public.profiles` with `role = 'admin'`.
4. Continue normal admin-managed profile creation through the app in later phases.

This keeps the admin-only profile policies strict while still giving the project a deliberate bootstrap path.

## Migration Audit Logs

`insert-migration-audit-log.sql` exists because the authenticated insert policy for `public.audit_logs` requires `actor.id` to match `auth.uid()`.

That policy is correct for user-scoped app writes. During imports or server-side maintenance, logs may need to be written on behalf of another actor or a migration process. Use a trusted service-role/admin context for those writes so RLS is bypassed intentionally server-side.

## Idempotency

Both scripts use `external_firebase_id` where relevant. Prefer stable external IDs for imported Firebase records so scripts can be retried safely.

The JavaScript migration scripts are retry-safe:

- `export-firebase.mjs` writes Firebase Auth, `users`, `bookings`, and `logs` data to
  `exports/`.
- `transform.mjs` converts the export into Supabase-shaped rows under `transformed/`.
- `import-supabase.mjs` reuses existing Supabase Auth users by email and upserts
  `profiles`, `bookings`, and `audit_logs` by stable IDs.
- `migrate.mjs` runs export, transform, and import in sequence.

`exports/` and `transformed/` are ignored by git because they can contain production data.

## Running Phase 9 Migration

Dry-run first:

```bash
node scripts/migrate-firebase-to-supabase/migrate.mjs
```

Apply after the dry-run counts look correct:

```bash
node scripts/migrate-firebase-to-supabase/migrate.mjs --apply
```

Individual steps can also be run directly:

```bash
node scripts/migrate-firebase-to-supabase/export-firebase.mjs
node scripts/migrate-firebase-to-supabase/transform.mjs --input=<export-json>
node scripts/migrate-firebase-to-supabase/import-supabase.mjs --input=<transformed-json>
node scripts/migrate-firebase-to-supabase/import-supabase.mjs --input=<transformed-json> --apply
```

Required local environment:

- Firebase Admin credentials: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`
- Supabase service role import credentials: `NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`

Do not commit generated JSON exports or paste their contents into issues, chats, or logs.

## Post-Import Log Sanitization

`sanitize-audit-logs.mjs` scans `audit_logs` rows and strips sensitive fields from `metadata` and
`target` JSONB columns. Run it after import if the source Firebase logs contained un-sanitized
sensitive data (tokens, passwords, card numbers, etc.).

```bash
node scripts/migrate-firebase-to-supabase/sanitize-audit-logs.mjs         # dry run
node scripts/migrate-firebase-to-supabase/sanitize-audit-logs.mjs --apply # apply
```

The transform step already sanitizes during migration, so this is only needed for legacy data
that was inserted directly or before sanitization was added.
