# Auth Module — Consolidation & Test Coverage Audit

**Date:** 2026-08-29
**Skill:** `code-simplification` + `test-driven-development`
**Scope:** `src/modules/auth/`, `src/services/auth/`

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| MEDIUM | 2 | Patches applied |
| LOW | 1 | Informational |

---

## Findings

### MEDIUM-1 — `toAuthenticatedUser` duplicated across files

**Files:** `authService.ts`, `sessionService.ts`

**Problem:** The same function was defined twice — once as a nested ternary in `sessionService.ts` and once with an extracted `getMetadataName` helper in `authService.ts`. Both converted a Supabase user to `AuthenticatedUser`.

**Fix:** Extracted a single `toAuthenticatedUser` into `types.ts` and updated both files to import it.

### MEDIUM-2 — `toAuthServiceError` triplicated across files

**Files:** `authService.ts`, `sessionService.ts`, `roleService.ts`

**Problem:** The same error-wrapping pattern was defined three times. The `authService.ts` version additionally mapped `AuthApiError`/`AuthError` to `auth/invalid_credentials`.

**Fix:** Extracted the base `toAuthServiceError` into `types.ts`. `authService.ts` keeps its extended version (which calls the base and adds Supabase-specific mapping). `sessionService.ts` and `roleService.ts` import from `types.ts`.

---

## Test Coverage Expansion

### `roleClaim.test.ts` — 4 → 11 tests

Added edge cases:
- Empty string `claimRole` and `routeKey`
- Numeric `claimRole` (`0`, `1`)
- Boolean `claimRole` (`true`, `false`)
- Case sensitivity (`'Admin'`, `'ADMIN'`, `'Accounting'`)
- Object as `claimRole`, array as `routeKey`
- `accountant` role access patterns

### `roleCache.test.ts` — 9 → 19 tests

Added edge cases:
- Multiple users cached simultaneously
- Re-set overwrites and resets TTL
- Empty string userId
- Evict then re-set cycle
- `undefined` as profileRole and claimRole
- Both null/undefined fallback to DEFAULT_ROLE
- `DEFAULT_ROLE` assertion (`'front_desk'`)
- All three valid roles tested

---

## Informational Findings (not patched)

### INFO-1 — `AuthStateSync.tsx` fire-and-forget race

The component subscribes to Supabase auth changes and fires a `getCurrentSession()` promise on mount. If the component unmounts before the promise resolves, it dispatches to a stale Redux dispatch. This is a pre-existing React Strict Mode concern and not patched to avoid behavioral changes.

### INFO-2 — `roleService.ts` is very thin

`fetchUserRole` is a one-liner wrapping `fetchUserAccessProfile`. The separation is defensible for clarity but could be inlined into `authService.ts` in a future cleanup.

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/auth/types.ts` | Added `toAuthenticatedUser` and `toAuthServiceError` shared utilities |
| `src/services/auth/authService.ts` | Removed local `toAuthenticatedUser`, `getMetadataName`; imports from `types.ts` |
| `src/services/auth/sessionService.ts` | Removed local `toAuthenticatedUser`, `toAuthServiceError`; imports from `types.ts` |
| `src/services/auth/roleService.ts` | Removed local `toAuthServiceError`; imports from `types.ts` |
| `src/services/auth/roleClaim.test.ts` | Expanded from 4 to 11 tests |
| `src/services/auth/roleCache.test.ts` | Expanded from 9 to 19 tests |

## Verification

- TypeScript: clean (`tsc --noEmit`)
- Tests: 207/207 passing across auth, rooms, accounting, and reservations modules
