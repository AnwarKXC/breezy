# Security Audit: Users & Auth Module

**Task:** 1.2 — Users Auth Audit  
**Date:** 2026-08-29  
**Scope:** `src/services/auth/*`, `src/modules/users/*`, `src/app/api/users/*`, `src/app/api/auth/*`, `src/config/roles.ts`, `src/config/actionPermissions.ts`  
**Method:** Manual code review + agent-skills security-review checklist

---

## Executive Summary

The auth and user management layer is well-structured with defense-in-depth: JWT verification via JWKS, RBAC enforced at both API and service layers, CSRF protection, rate limiting, and server-only imports throughout. **0 critical, 0 high, 2 medium, 2 low, 2 informational** findings.

---

## Findings

### MEDIUM-1: Role cache not invalidated on role changes

**Files:** `src/services/auth/roleCache.ts`, `src/modules/users/services/userAuthSync.ts`

When an admin updates a user's role via `updateUser()` → `syncAuthUser()`, the `roleCache` (60-second TTL) is never cleared. The affected user retains their old permissions for up to 60 seconds after the change. In a high-turnover admin scenario, this window could allow a demoted user to perform actions under their former role.

**Fix:** Call `roleCache.clear()` (or `roleCache.delete(userId)`) after a role change in `syncAuthUser`.

### MEDIUM-2: No self-deletion or self-demotion guard

**File:** `src/modules/users/services/userService.ts`

`deleteUser` and `updateUser` do not check whether the target user is the acting user. An admin can:
- Delete themselves — potentially locking out the only admin account.
- Demote themselves from admin to front_desk — losing admin access.

**Fix:** Add a self-action guard in `deleteUser` and `updateUser` that refuses the operation when `actor.id === targetId`.

### LOW-1: `authRequest.ts` returns empty string for missing token

**File:** `src/modules/users/services/authRequest.ts`

`getRequestToken` returns `''` instead of `null`/`undefined` when no Authorization header is present. The downstream `verifyServerToken` throws on empty tokens, so this is functionally safe, but the empty-string convention is fragile and could confuse future maintainers.

**Fix:** Return `null` instead of `''`.

### LOW-2: `deleteUser` uses 876000h ban instead of permanent

**File:** `src/modules/users/services/userService.ts`

`ban_duration: '876000h'` (100 years) is used instead of Supabase's permanent ban. While 100 years is effectively permanent, it introduces a theoretical re-enablement window and an unnecessary magic number.

**Fix:** Use `'none'` for permanent ban (Supabase supports this).

### INFO-1: Role precedence is correctly defined

**File:** `src/services/auth/roleCache.ts`

`resolveRole(profileRole, claimRole)` correctly prioritizes: DB profile role > JWT claim role > default (`front_desk`). This is the recommended pattern.

### INFO-2: Raw Supabase errors in `userAuthSync.ts` are safe

**File:** `src/modules/users/services/userAuthSync.ts`

Raw errors thrown by `syncAuthUser` are caught by `guarded()` in `userService.ts` and mapped to generic error codes, so they do not leak to the client.

---

## Verification

- All API routes use `authorizeRoute` with specific action permissions.
- RBAC is enforced at both API layer (`authorizeRoute`) and service layer (`require*` functions).
- `server-only` imports prevent client-side execution of server logic.
- `guarded()` wrapper maps unexpected errors to generic codes.
- JWT verification uses JWKS with proper issuer and audience checks.
- No privilege escalation paths found — admin is the only role that can manage users.
