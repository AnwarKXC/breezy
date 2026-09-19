-- ============================================================
-- Migration: Performance Indexes
-- Generated: 2026-05-18
-- Addresses: Missing GIN index for audit_logs JSONB path queries,
--   pg_trgm extension for ilike search on contacts
-- ============================================================

-- 1. GIN index on audit_logs.target for JSONB path queries
--    Used by getLogsForContact() which queries target->>'id'
create index if not exists audit_logs_target_gin_idx
  on public.audit_logs using gin (target jsonb_path_ops);

-- 2. Add index on audit_logs (module) for module-filtered queries
create index if not exists audit_logs_module_idx
  on public.audit_logs (module);

-- 3. pg_trgm extension for efficient ilike search on contacts
create extension if not exists pg_trgm;

create index if not exists contacts_name_trgm_idx
  on public.contacts using gin (lower(name) gin_trgm_ops);

create index if not exists contacts_phone_trgm_idx
  on public.contacts using gin (phone gin_trgm_ops);

create index if not exists contacts_email_trgm_idx
  on public.contacts using gin (lower(email) gin_trgm_ops);
