# Research: RLS and Security

## Decision 1: Policy Granularity Strategy

- **Decision**: One policy per DML operation per table (SELECT/INSERT/UPDATE/DELETE), using the existing naming convention `{table}_{operation}_{role_hint}`.
- **Rationale**: Matches the existing pattern in all prior migrations (e.g., `reservations_select_staff`, `reservations_insert_writers`). Individual policies are easier to audit, debug, and drop/recreate independently. Combined policies (one policy covering multiple operations) would require complex USING + WITH CHECK combinations that are harder to reason about.
- **Alternatives considered**: Combined multi-operation policies (one policy per table) — rejected because they make it harder to identify which specific operation is being permitted during audits.

## Decision 2: Column-Level Security Approach

- **Decision**: Use policy-level `USING` and `WITH CHECK` expressions that call role-checking helper functions. Sensitive columns (pricing, internal_notes, guarantee_type, deleted_at) are protected by `WITH CHECK` expressions that evaluate `can_override_pricing()` or admin-level checks. Column-level privileges (`GRANT UPDATE (col)`) are NOT used — they would require a separate grant per column per role and are harder to manage.
- **Rationale**: Helper functions in `WITH CHECK` are the standard Supabase/Postgres pattern for conditional write permissions. They evaluate inline with the query, require no additional grants, and are self-documenting.
- **Alternatives considered**: Column-level `GRANT` statements — rejected because they add surface area for misconfiguration and don't compose well with RLS.

## Decision 3: Terminal State Protection

- **Decision**: UPDATE policies for reservation_rooms and reservation_pricing_items will include a `WITH CHECK` condition that checks the parent reservation's status is NOT in a terminal state (`checked_out`, `cancelled`, `no_show`). This uses a subquery `(SELECT status FROM public.reservations WHERE id = reservation_id) NOT IN ('checked_out', 'cancelled', 'no_show')`.
- **Rationale**: Database-level enforcement prevents bypass even if application code fails to check. The subquery approach avoids needing to denormalize status onto child tables.
- **Alternatives considered**: Application-only enforcement — rejected because defense-in-depth requires database enforcement. Denormalizing status onto child tables — rejected because it adds complexity and sync risk.

## Decision 4: RPC Permission Checks

- **Decision**: Each existing RPC (confirm_reservation, cancel_reservation, check_in, check_out, get_room_availability) will have a permission guard added at the top of the function body using `PERFORM` with the appropriate `can_*` helper, raising `EXCEPTION` with `42501` (insufficient_privilege) on failure.
- **Rationale**: RPCs bypass RLS when called with `security definer`. Explicit permission checks inside the RPC body ensure authorization regardless of how the RPC is invoked.
- **Alternatives considered**: Running RPCs with `security invoker` — rejected because existing RPCs use `security definer` and changing would require verifying all callers have proper table-level permissions.

## Decision 5: Testing Approach

- **Decision**: Manual SQL test scripts executed via Supabase SQL editor or `psql`. Each script exercises a specific (role × operation × state) combination and returns PASS/FAIL. A master test runner script iterates all combinations.
- **Rationale**: No existing automated test framework for database policies. pgTAP would require installing an extension and changes to the CI pipeline. Manual SQL scripts are low-ceremony, immediately executable, and can be converted to pgTAP later if needed.
- **Alternatives considered**: pgTAP — deferred to post-MVP. Application-level integration tests — insufficient for testing database-level RLS directly.

## Decision 6: Migration Idempotency

- **Decision**: Use `CREATE POLICY IF NOT EXISTS` for new policies and `DROP POLICY IF EXISTS` followed by `CREATE POLICY` for policies being replaced (since there is no `CREATE OR REPLACE POLICY` in PostgreSQL). New helper functions use `CREATE OR REPLACE FUNCTION`.
- **Rationale**: Idempotency allows the migration to be applied multiple times without errors, which is important for local dev, CI, and production rollbacks.
- **Alternatives considered**: `DROP POLICY IF EXISTS` + `CREATE POLICY` unconditionally — rejected because we need IF NOT EXISTS for policies we're keeping but don't want to rebuild on re-run.

## Decision 7: Audit Logging Integration

- **Decision**: No database triggers. Application-level audit via API services calling `INSERT INTO public.audit_logs` after each reservation mutation. The existing `log_action` enum already includes reservation-specific values (`reservation_confirmed`, `reservation_cancelled`, etc.).
- **Rationale**: Consistent with existing project pattern. No new trigger infrastructure needed. Audit is tied to the application logic that performs the mutation, ensuring the audit entry captures business context.
- **Alternatives considered**: Database triggers — rejected during clarification session.

## Decision 8: Existing Role Mapping

- **Decision**: Only three roles are used: admin, front_desk, accountant. The `manager` role was considered but does not exist in the `app_role` enum and will NOT be added. Manager-level permissions are mapped to the existing `admin` role. The `housekeeping` and `maintenance` roles exist in the enum but are out of scope for reservation access — they will be denied by default.
- **Rationale**: Keeping the existing 3-role model minimizes migration complexity and avoids the need for a schema-enum change. Admin role already covers all sensitive/manager operations.
- **Alternatives considered**: Adding `manager` to the enum — rejected. No clear use case yet for a separate manager role distinct from admin.

## Decision 9: Permission Helper Function Design

- **Decision**: New helper functions follow the existing pattern (`public.can_*`):
  - `public.can_cancel_reservations()` — admin only
  - `public.can_override_pricing()` — already exists (admin only)
  - `public.can_manage_internal_notes()` — admin only
  - `public.can_manage_guarantee()` — front_desk + admin (view/update standard guarantees), admin only (override)
  - `public.can_force_assign_room()` — admin only
  - `public.can_refund_payment()` — admin only
  - `public.can_delete_reservations()` — admin only (wraps is_admin())
- **Rationale**: Granular helpers make policies self-documenting and allow future role changes without rewriting all policies.
- **Alternatives considered**: Inline checks in policy expressions — rejected because they're harder to audit and maintain.

## Decision 10: Supabase RLS Best Practices

- **Decision**: All policies target `to authenticated` (not `to public`). Default-deny is implicit — PostgreSQL denies all operations when no policy matches. The `current_app_role()` function reads from the JWT via `auth.jwt() -> 'app_role'`.
- **Rationale**: Standard Supabase RLS pattern. JWT-based role claims avoid an extra database lookup per query. Authenticated-only ensures unauthenticated requests are always blocked.
- **Sources**: Supabase docs on RLS, existing project migration patterns.
