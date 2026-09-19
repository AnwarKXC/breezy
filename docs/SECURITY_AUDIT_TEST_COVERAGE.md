# Phase 3 — Test Coverage Expansion (Tasks 3.2–3.4)

**Date:** 2026-08-29
**Skill:** `test-driven-development`
**Scope:** `src/modules/dashboard/`, `src/modules/logs/`, `src/modules/room-types/`, `src/modules/pricing/`

---

## Summary

| Module | New Test File | Tests | Coverage |
|--------|--------------|-------|----------|
| Dashboard | `store/__tests__/dashboardSlice.test.ts` | 8 | Redux slice + selectors |
| Logs | `utils/__tests__/logDisplay.test.ts` | 17 | All pure display utilities |
| Room Types | `types/__tests__/types.test.ts` | 8 | `mapRoomTypeRow` + `toRoomTypeRow` |
| Pricing | `types/__tests__/types.test.ts` | 6 | `mapPricingRow` |

**Total: 4 new test files, 39 new tests, all passing.**

---

## New Test Files

### `src/modules/logs/utils/__tests__/logDisplay.test.ts` (17 tests)

Tests all pure display utilities with zero mocking:
- `getActionLabel` — known actions, unknown action fallback
- `getModuleLabel` — known modules, unknown module fallback
- `getActorLabel` — displayName/name/id priority chain, missing actor
- `getTargetLabel` — target id, missing target
- `getLogDescription` — description lookup, fallback composition
- `formatLogDate` — valid timestamps, null/undefined/invalid inputs

### `src/modules/room-types/types/__tests__/types.test.ts` (8 tests)

Tests pure data mapping functions:
- `mapRoomTypeRow` — full field mapping, base_price string-to-number, null description
- `toRoomTypeRow` — CreateInput field inclusion, UpdateInput field inclusion, empty input, base_price mapping

### `src/modules/pricing/types/__tests__/types.test.ts` (6 tests)

Tests pure data mapping function:
- `mapPricingRow` — full field mapping, price string-to-number, null price_single/price_double/price_triple, effectiveFrom/Until passthrough

### `src/modules/dashboard/store/__tests__/dashboardSlice.test.ts` (8 tests)

Tests Redux slice and selectors:
- Initial state, pending/fulfilled/rejected actions
- `selectDashboardData`, `selectDashboardLoading`, `selectDashboardError` selectors

---

## Informational Findings

### INFO-1 — `getErrorMessage` in dashboardSlice doesn't extract Error messages

The `getErrorMessage(error)` function checks `error instanceof Error` but Redux Toolkit's `rejected` action passes `action.error` as a `SerializedError` (not an `Error` instance). This means the function always returns `'dashboard/request_failed'` regardless of the actual error message. Consider updating to also check `error?.message`.

### INFO-2 — `timestampToDate` not directly tested

The `timestampToDate` function in `logDisplay.ts` is not exported, so it's tested indirectly via `formatLogDate`. The test coverage is sufficient through the indirect tests.

---

## Verification

- TypeScript: clean (`tsc --noEmit`)
- Tests: 244/244 passing across all touched modules
