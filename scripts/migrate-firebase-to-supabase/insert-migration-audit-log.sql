-- Insert or update an audit log from a trusted service-role/admin context.
--
-- Use this for migration/server-side writes that intentionally bypass the
-- user-scoped audit_logs insert policy requiring actor.id = auth.uid().
--
-- Required psql variables:
--   external_firebase_id  Stable source log ID for idempotency
--   action                public.log_action value
--   module                public.log_module value
--   description           Human-readable log description
--   actor_json            JSON object for actor
--
-- Optional psql variables:
--   target_json           JSON object for target, or null
--   metadata_json         JSON object for metadata, or null
--   created_at            Original timestamp, or now()
--
-- Example:
--   psql "$DATABASE_URL" \
--     -v external_firebase_id="firebase-log-id" \
--     -v action="login" \
--     -v module="auth" \
--     -v description="Imported Firebase log" \
--     -v actor_json='{"id":"firebase-user-id","name":"Hotel Admin","role":"admin"}' \
--     -v target_json='null' \
--     -v metadata_json='{"source":"firebase-import"}' \
--     -v created_at="2026-05-12T00:00:00Z" \
--     -f scripts/migrate-firebase-to-supabase/insert-migration-audit-log.sql

\if :{?target_json}
\else
\set target_json 'null'
\endif

\if :{?metadata_json}
\else
\set metadata_json 'null'
\endif

\if :{?created_at}
\else
\set created_at ''
\endif

begin;

insert into public.audit_logs (
  external_firebase_id,
  action,
  module,
  description,
  actor,
  target,
  metadata,
  created_at
)
values (
  :'external_firebase_id',
  :'action'::public.log_action,
  :'module'::public.log_module,
  :'description',
  :'actor_json'::jsonb,
  nullif(:'target_json', 'null')::jsonb,
  nullif(:'metadata_json', 'null')::jsonb,
  coalesce(nullif(:'created_at', '')::timestamptz, now())
)
on conflict (external_firebase_id) do update
set
  action = excluded.action,
  module = excluded.module,
  description = excluded.description,
  actor = excluded.actor,
  target = excluded.target,
  metadata = excluded.metadata,
  created_at = excluded.created_at
returning id, external_firebase_id, action, module, description, actor, target, metadata, created_at;

commit;
