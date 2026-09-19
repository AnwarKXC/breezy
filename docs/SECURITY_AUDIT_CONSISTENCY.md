# Phase 4 — Consistency & Cleanup (Tasks 4.1–4.2)

**Date:** 2026-08-29
**Skill:** `api-and-interface-design` + `code-simplification`
**Scope:** All API clients and Redux slices

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| MEDIUM | 3 | Patches applied |
| LOW | 2 | Patches applied |
| INFO | 4 | Noted |

---

## Findings

### MEDIUM-1 — Error code strings displayed to users

**Files:** `contactsApiClient.ts`, `usersApiClient.ts`, `logsApiClient.ts`

**Problem:** `defaultError` used error-code-style strings like `'contacts/request_failed'`, `'auth/request_failed'`, `'logs/request_failed'`. These are displayed verbatim in toast notifications to users.

**Fix:** Replaced with human-readable messages:
- `contactsApiClient.ts`: `'Failed to load contacts'`
- `usersApiClient.ts`: `'Failed to load users'`
- `logsApiClient.ts`: `'Failed to load logs'`

### MEDIUM-2 — `dashboardApiClient` had no network error handling

**File:** `src/modules/dashboard/services/dashboardApiClient.ts`

**Problem:** Raw `fetch()` call with no `try/catch`. Network errors (offline, DNS failure) produced unhandled promise rejections.

**Fix:** Wrapped in `try/catch` with consistent error message: `'Failed to load dashboard data'`.

### MEDIUM-3 — `getErrorMessage` didn't handle `SerializedError`

**File:** `src/modules/dashboard/store/dashboardSlice.ts`

**Problem:** `getErrorMessage(error)` only checked `error instanceof Error`, but Redux Toolkit's `rejected` action passes `action.error` as a `SerializedError` (`{ message?: string }`), not an `Error` instance. Error messages were always falling back to `'dashboard/request_failed'`.

**Fix:** Added check for `error?.message` property: `if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message`.

### LOW-1 — Dead `allPayments` state in accounting slice

**File:** `src/modules/accounting/store/accountingSlice.ts`

**Problem:** `allPayments: Payment[]` was declared in state and initialized to `[]`, but no reducer ever populated it. The `payments` field (`Record<string, Payment[]>`) is the one actually used.

**Fix:** Removed `allPayments` from `AccountingState` interface and `initialState`.

### LOW-2 — Dead `clearError` action in accounting slice

**File:** `src/modules/accounting/store/accountingSlice.ts`

**Problem:** `clearError` reducer was exported but never imported or dispatched by any component.

**Fix:** Removed `clearError` reducer and its export.

---

## Informational Findings (not patched)

### INFO-1 — Three dead Redux slices

`pricingSlice.ts`, `roomTypesSlice.ts`, and `roomsSlice.ts` are registered in the store but completely unused. All three modules use local React hooks (`usePricing`, `useRoomTypes`, `useRooms`) that call API clients directly. Removing these would require updating the store configuration — deferred to a larger refactor.

### INFO-2 — `accountingApiClient` has 12+ manual fetch functions

The accounting API client has 3 CRUD clients + 12 hand-written `fetch()` functions that lack network error handling, `Content-Type` headers, and toast integration. This is the most inconsistent client but refactoring it would be a large effort.

### INFO-3 — Mixed toast strategy across clients

Three different approaches coexist: `contacts` suppresses toasts (`toast: false`), `rooms` uses custom messages, others use defaults. This is a pre-existing inconsistency.

### INFO-4 — Single `loading`/`error` for multiple operations

All slices except users use a single `loading: boolean` for all async operations. Concurrent fetches overwrite each other's loading state.

---

## Files Changed

| File | Change |
|------|--------|
| `src/modules/contacts/services/contactsApiClient.ts` | Human-readable error message |
| `src/modules/users/services/usersApiClient.ts` | Human-readable error message |
| `src/modules/logs/services/logsApiClient.ts` | Human-readable error message |
| `src/modules/dashboard/services/dashboardApiClient.ts` | Added try/catch for network errors |
| `src/modules/dashboard/store/dashboardSlice.ts` | Fixed `getErrorMessage` for SerializedError |
| `src/modules/dashboard/store/__tests__/dashboardSlice.test.ts` | Updated tests for new error handling |
| `src/modules/accounting/store/accountingSlice.ts` | Removed dead `allPayments` state and `clearError` action |

## Verification

- TypeScript: clean (`tsc --noEmit`)
- Tests: 245/245 passing across all touched modules
