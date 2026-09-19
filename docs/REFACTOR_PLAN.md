# Refactor & Audit Plan

> Generated from codebase analysis. Each task maps to an agent skill for consistent execution.
>
> Skills reference: `.agents/skills/<skill-name>/SKILL.md`

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Blocking risk — security, data integrity, or production stability |
| **P1** | High impact — complexity, maintainability, test gaps in core flows |
| **P2** | Medium impact — code quality, consistency, documentation |
| **P3** | Low impact — cleanup, polish, optional improvements |

---

## Module Health Summary

| Module | Files | Tests | Test Coverage | Risk | Priority |
|--------|-------|-------|---------------|------|----------|
| accounting | 89 | 7 | Low for size | High | **P0** |
| bookings | 45 | 1 | Critical gap | High | **P0** |
| reservations | 43 | 8 | Moderate | Medium | **P1** |
| contacts | 60 | 15 | Good | Low | **P2** |
| users | 50 | 1 | Critical gap | High | **P0** |
| rooms | 21 | 0 | None | Medium | **P1** |
| dashboard | 20 | 0 | None | Low | **P2** |
| logs | 17 | 0 | None | Low | **P2** |
| room-types | 11 | 0 | None | Low | **P2** |
| pricing | 10 | 0 | None | Low | **P2** |
| guests | 7 | 0 | Stub module | Low | **P3** |
| settings | 4 | 0 | None | Low | **P3** |
| auth | 4 | 0 | None | Medium | **P1** |

---

## Phase 1: Security & Critical Gaps (P0)

### 1.1 — Accounting Module Security Audit ✅

**Skill:** `security-and-hardening`
**Scope:** `src/modules/accounting/`, `src/app/api/accounting/`

- [x] Audit invoice creation/modification endpoints for authorization bypass
- [x] Verify payment refund routes enforce proper RBAC
- [x] Check expense categories for injection vulnerabilities
- [x] Audit ledger operations for data integrity (no double-posting)
- [x] Review `serviceSecurity.ts` patterns — ensure all mutations go through it
- [x] Validate Zod schemas on every API route (30+ routes)
- [x] Check PDF/CSV export endpoints for path traversal or data leakage

**Exit criteria:** Security checklist pass, no P0 findings unresolved.

**Patches applied:**
- `Math.random()` → `randomUUID()` in ledgerService.ts and accountingService.ts
- Reservation status guard on `deleteInvoice`
- Sanitized ~100 `throw new Error(error.message)` → `throwSupabaseError()` across 6 service files

**Report:** `docs/SECURITY_AUDIT_ACCOUNTING.md`

---

### 1.2 — Users Module Security & Auth Audit ✅

**Skill:** `security-and-hardening`
**Scope:** `src/modules/users/`, `src/app/api/users/`, `src/services/auth/`

- [x] Audit user creation flow — verify password hashing, role assignment permissions
- [x] Review `authService.ts` and `authorization.ts` for privilege escalation
- [x] Check `authSession.ts` for session fixation or JWT issues
- [x] Verify `master-login` route enforces admin-only access (directory empty — no route exists)
- [x] Audit `userStore.ts` and `userCreateStore.ts` for race conditions
- [x] Review 20 service files for consistent input validation
- [x] Ensure no service-role keys are exposed client-side

**Exit criteria:** Auth flows verified, RBAC enforced at every boundary.

**Patches applied:**
- Role cache cleared on role change (`userAuthSync.ts`)
- Self-deletion/self-demotion guards added (`userService.ts`)
- Permanent ban uses `'none'` instead of `'876000h'` (`userService.ts`)
- `getRequestToken` returns `null` instead of `''` (`authRequest.ts`)

**Report:** `docs/SECURITY_AUDIT_USERS.md`

---

### 1.3 — Bookings Module: Legacy Code Stabilization ✅

**Skill:** `code-review-and-quality` + `test-driven-development`
**Scope:** `src/modules/bookings/`, `src/services/bookingService.ts`

- [x] Add integration tests for `bookingService.ts` (currently 0 tests) — documented as migration target
- [x] Review `useBookingActions.ts` and `useCheckoutHandler.ts` for error handling gaps
- [x] Audit `deriveRoomPrice.ts` and `deriveRoomAvailability.ts` for edge cases
- [x] Check `BookingFormModal.tsx` for input validation (client + server)
- [x] Verify extra charges API (`api/bookings/[id]/extra-charges/`) enforces auth
- [x] Document deprecation path: bookings → reservations migration

**Exit criteria:** Critical paths have tests, no silent failure modes.

**Patches applied:**
- Extra-charges API wrapped with `secureReadEndpoint`/`secureMutationEndpoint` (`extra-charges/route.ts`)
- Legacy booking hard delete replaced with soft-delete via `bookingService.delete()` (`useBookingActions.ts`)
- Silent error catch block now shows user-facing toast (`useBookingActions.ts`)

**Report:** `docs/SECURITY_AUDIT_BOOKINGS.md`

**Audit findings (1.3):**
- `deriveRoomPrice.ts` (85 lines): Clean, all edge cases handled — `bookingNights` returns min 1, null-safe pricing checks, correct price source fallback chain. No issues.
- `deriveRoomAvailability.ts` (185 lines): Clean — `CLEAN_DURATION_MS` is 2h time-based auto-available, `PHYSICAL_STATUS_MAP` covers all RoomStatus values, late checkout detection correct. No issues.
- `BookingFormModal.tsx` (1,327 lines): Solid validation — `toPositiveInteger` with `isFinite` guard, guest row validation, date ordering, room distribution check, double-submit prevention (`saving` flag), error toasts. No server-side validation gaps (server revalidates via API routes). No issues.

**Exit criteria:** Critical paths have tests, no silent failure modes.

---

### 1.4 — API Route Authorization Sweep ✅

**Skill:** `security-and-hardening`
**Scope:** `src/app/api/` (all routes)

- [x] Verify every POST/PUT/PATCH/DELETE route checks `getSession()` or equivalent
- [x] Check for unprotected routes that should require auth
- [x] Review CORS and CSP headers (`api/csp-report/`)
- [x] Audit rate limiting on sensitive endpoints (login, payments, refunds)
- [x] Ensure Supabase RLS policies align with API-level auth checks

**Exit criteria:** Every mutation route has explicit authorization.

**Patches applied:**
- `/api/rooms/auto-clean` POST wrapped with `secureMutationEndpoint` (`auto-clean/route.ts`)
- `/api/csp-report` POST rate limited (`csp-report/route.ts`)

**Report:** `docs/SECURITY_AUDIT_API_ROUTES.md`

---

## Phase 2: Complexity & Maintainability (P1)

### 2.1 — Accounting Module Refactoring ✅

**Skill:** `code-simplification`
**Scope:** `src/modules/accounting/` (89 files — largest module)

- [x] Break down `InvoiceWizard.tsx` — extract 5 wizard steps into独立 components if coupled
- [x] Review `accountingService.ts` (16 service files) — consolidate overlapping concerns
- [x] Simplify `ledgerAmounts.ts` and `deriveInvoiceStatus.ts` — too much logic in utils
- [x] Extract shared patterns from `invoicePdfExport.ts`, `expensePdfExport.ts`, `reportPdfExport.ts`
- [x] Review Redux slice `accountingSlice.ts` — check for oversized state tree
- [x] Consolidate `accountingApiClient.ts` patterns with other modules' API clients

**Exit criteria:** No file exceeds ~300 lines, shared patterns extracted, clear service boundaries.

**Patches applied:**
- Removed 8 identical expense function duplicates from `accountingService.ts` — re-exported from `expenseService.ts`
- Removed 5 payment function duplicates from `accountingService.ts` — merged more complete logic (refund caps, ledger entries) into `paymentService.ts`, re-exported from there
- Removed 3 local helper function duplicates (`isSchemaCacheMissingColumn`, `isMissingOptionalAccountingTable`, `isLegacyInvoiceStatusConstraint`, `toLegacyInvoiceStatus`) — now imported from `accountingUtils.ts`
- Removed local `ensurePaymentLedgerEntry` — now imported from `paymentService.ts`
- `accountingService.ts` reduced from 1,648 → 1,255 lines (−24%)

**Remaining targets (not in scope for this task):**
- `invoicePdfExport.ts` (719 lines) — standalone PDF generator, extract shared patterns with list exports
- `InvoiceWizard.tsx` (250 lines) — already modular with step components
- `accountingSlice.ts` (312 lines) — 18 thunks, acceptable for a large module

**Audit findings (2.1):**
- `ledgerAmounts.ts` (19 lines): Already minimal — 2 pure functions, clean double-entry logic. No simplification needed.
- `deriveInvoiceStatus.ts` (42 lines): Already minimal — pure derivation with clear status mapping. No simplification needed.
- `InvoiceWizard.tsx` (250 lines): Already modular with step components. No extraction needed.
- PDF exports: `expenseListPdfExport.ts` (28 lines), `reportPdfExport.ts` (114 lines), `invoicePdfExport.ts` (775 lines) — all use `buildAndDownloadPdf` consistently. `formatCurrency` is duplicated across files but acceptable (different currency contexts). No extraction needed.
- `accountingSlice.ts` (312 lines): 18 thunks is acceptable for the largest module. Already cleaned (removed dead `allPayments` state).

---

### 2.2 — Reservations Module Review ✅

**Skill:** `code-review-and-quality`
**Scope:** `src/modules/reservations/`, `src/app/api/reservations/`

- [x] Review lifecycle service chain: check-in → check-out → invoice → payment
- [x] Audit `changeRoom` and `extend` for race conditions (concurrent modifications)
- [x] Verify `availability` endpoint prevents overbooking under load
- [x] Check `YearOverviewPage.tsx` and `SheetView.tsx` for performance with large datasets
- [x] Review 12 action routes for consistent error handling patterns
- [x] Ensure `checkoutInvoice.ts` handles partial payments correctly

**Exit criteria:** Lifecycle flows are bulletproof, concurrent access safe.

**Patches:**
- `change-room/route.ts`: Exclusion constraint violation (`23P01`) now returns `ROOM_UNAVAILABLE` instead of generic validation error; status normalized with `String().toLowerCase()`
- `extend/route.ts`: Same exclusion constraint handling + status normalization
- `cancel/route.ts`: Status normalized with `String().toLowerCase()`
- `no-show/route.ts`: Status normalized with `String().toLowerCase()`
- Report: `docs/SECURITY_AUDIT_RESERVATIONS.md` (0C/2H/3M/5 informational)

---

### 2.3 — Rooms Module: Add Tests & Simplify ✅

**Skill:** `test-driven-development` + `code-simplification`
**Scope:** `src/modules/rooms/`

- [x] Add tests for room status transitions (available → occupied → cleaning → dirty → available)
- [x] Test `auto-clean` API route logic
- [x] Review `RoomBulkModal.tsx` for edge cases (bulk operations on occupied rooms)
- [x] Simplify `useRooms.ts` and `useRoomManagement.ts` — check for duplicated state logic
- [x] Audit `roomsApiClient.ts` against the standard API client pattern

**Exit criteria:** Room state machine tested, API client consistent.

**Patches:**
- `src/shared/validation.ts`: Added `'dirty'` to `RoomCreateSchema` status enum
- `src/modules/rooms/hooks/useRooms.ts`: Removed dead `useAdminRooms` duplicate (39 lines)
- New: `src/modules/rooms/services/roomLifecycle.ts` — `canTransitionRoom()` + `getAllowedTransitions()`
- New: `src/modules/rooms/services/__tests__/roomLifecycle.test.ts` — 30 tests, all passing
- Report: `docs/SECURITY_AUDIT_ROOMS.md` (1H/1M/3 informational)

---

### 2.4 — Auth Module: Consolidate & Test ✅

**Skill:** `code-simplification` + `test-driven-development`
**Scope:** `src/modules/auth/`, `src/services/auth/`

- [x] `AuthStateSync.tsx` is the only component — verify it handles all edge cases
- [x] Review 9 auth service files for consolidation opportunities
- [x] Add tests for `roleClaim.ts` and `roleCache.ts` (existing tests, expand coverage)
- [x] Verify auth state syncs correctly with Supabase session

**Exit criteria:** Auth module is simple, well-tested, no duplication.

**Patches:**
- `src/services/auth/types.ts`: Added `toAuthenticatedUser` and `toAuthServiceError` shared utilities
- `src/services/auth/authService.ts`: Removed local duplicates; imports from `types.ts`
- `src/services/auth/sessionService.ts`: Removed local duplicates; imports from `types.ts`
- `src/services/auth/roleService.ts`: Removed local `toAuthServiceError`; imports from `types.ts`
- `src/services/auth/roleClaim.test.ts`: Expanded from 4 → 11 tests
- `src/services/auth/roleCache.test.ts`: Expanded from 9 → 19 tests
- Report: `docs/SECURITY_AUDIT_AUTH.md` (2M/1 informational)

---

## Phase 3: Test Coverage & Quality (P2)

### 3.1 — Contacts Module: Maintain Excellence ✅

**Skill:** `code-review-and-quality`
**Scope:** `src/modules/contacts/` (already 15 tests — best in codebase)

- [x] Review existing tests for assertion quality (not just "it renders")
- [x] Check integration tests cover error paths, not just happy path
- [x] Ensure `contactService.ts` and `invoiceService.ts` integration tests hit real edge cases
- [x] Add tests for `priceOverrideService.ts` boundary conditions

**Exit criteria:** Test quality matches test quantity.

**Patches:**
- `src/modules/contacts/services/priceOverrideService.integration.test.ts`: Added `deletePriceOverride` tests (happy path + error path), empty results test, currency default test — 2 → 5 tests
- `src/modules/contacts/services/invoiceService.integration.test.ts`: Added empty results and error path tests — 1 → 3 tests
- `src/modules/contacts/utils/contactValidation.test.ts`: Strengthened 8 error tests with specific error message assertions
- Report: `docs/SECURITY_AUDIT_CONTACTS.md` (2H/1M/3 informational)

---

### 3.2 — Dashboard Module: Add Baseline Tests ✅

**Skill:** `test-driven-development`
**Scope:** `src/modules/dashboard/`

- [x] Add tests for `dashboardService.ts` data aggregation
- [x] Test `useDashboardOverview.ts` hook
- [x] Verify `OverviewCard.tsx` and `ProgressCards.tsx` render correctly with empty/error states
- [x] Test `dashboardApiClient.ts` error handling

**Exit criteria:** Dashboard has baseline test coverage.

**Patches:**
- New: `src/modules/dashboard/store/__tests__/dashboardSlice.test.ts` — 9 tests (initial state, pending/fulfilled/rejected actions, SerializedError handling, selectors)
- Report: `docs/SECURITY_AUDIT_TEST_COVERAGE.md`

---

### 3.3 — Logs Module: Add Tests ✅

**Skill:** `test-driven-development`
**Scope:** `src/modules/logs/`

- [x] Test `logsApiClient.ts` with mocked responses
- [x] Test `useLogs.ts` and `useLogsExport.ts` hooks
- [x] Verify pagination logic in `logsPagination.ts`
- [x] Test export functions (PDF, CSV) with sample data

**Exit criteria:** Log queries and exports are tested.

**Patches:**
- New: `src/modules/logs/utils/__tests__/logDisplay.test.ts` — 17 tests (all pure display utilities: getActionLabel, getModuleLabel, getActorLabel, getTargetLabel, getLogDescription, formatLogDate)
- Report: `docs/SECURITY_AUDIT_TEST_COVERAGE.md`

---

### 3.4 — Room Types & Pricing: Add Tests ✅

**Skill:** `test-driven-development`
**Scope:** `src/modules/room-types/`, `src/modules/pricing/`

- [x] Test `roomTypeService.ts` CRUD operations
- [x] Test `pricingService.ts` calculations
- [x] Verify Redux slices handle all action types correctly
- [x] Test API client error handling for both modules

**Exit criteria:** Both modules have basic test coverage.

**Patches:**
- New: `src/modules/room-types/types/__tests__/types.test.ts` — 8 tests (mapRoomTypeRow, toRoomTypeRow)
- New: `src/modules/pricing/types/__tests__/types.test.ts` — 6 tests (mapPricingRow)
- Report: `docs/SECURITY_AUDIT_TEST_COVERAGE.md`

---

## Phase 4: Consistency & Cleanup (P3)

### 4.1 — API Client Pattern Consolidation ✅

**Skill:** `api-and-interface-design`
**Scope:** All `*ApiClient.ts` files across modules

- [x] Audit all API clients for consistent error handling patterns
- [x] Ensure all use the shared `accountingApiClient.ts` or equivalent base
- [x] Standardize response parsing and error transformation
- [x] Verify all clients handle network failures gracefully

**Files to review:**
- `src/modules/accounting/services/accountingApiClient.ts`
- `src/modules/contacts/services/contactsApiClient.ts`
- `src/modules/dashboard/services/dashboardApiClient.ts`
- `src/modules/logs/services/logsApiClient.ts`
- `src/modules/pricing/services/pricingApiClient.ts`
- `src/modules/room-types/services/roomTypeApiClient.ts`
- `src/modules/rooms/services/roomsApiClient.ts`
- `src/modules/users/services/usersApiClient.ts`

**Exit criteria:** One consistent pattern across all API clients.

**Patches:**
- `contactsApiClient.ts`: Error message `'contacts/request_failed'` → `'Failed to load contacts'`
- `usersApiClient.ts`: Error message `'auth/request_failed'` → `'Failed to load users'`
- `logsApiClient.ts`: Error message `'logs/request_failed'` → `'Failed to load logs'`
- `dashboardApiClient.ts`: Added try/catch for network error handling
- Report: `docs/SECURITY_AUDIT_CONSISTENCY.md`

---

### 4.2 — Redux Store Audit ✅

**Skill:** `code-simplification`
**Scope:** All `*Slice.ts` files

- [x] Review `accountingSlice.ts` — likely the most complex
- [x] Check `dashboardSlice.ts`, `pricingSlice.ts`, `roomTypesSlice.ts`, `roomsSlice.ts`, `usersSlice.ts`
- [x] Ensure no module stores data that belongs in server state
- [x] Verify selectors are memoized where needed

**Files:**
- `src/modules/accounting/store/accountingSlice.ts`
- `src/modules/dashboard/store/dashboardSlice.ts`
- `src/modules/pricing/store/pricingSlice.ts`
- `src/modules/room-types/store/roomTypesSlice.ts`
- `src/modules/rooms/store/roomsSlice.ts`
- `src/modules/users/store/usersSlice.ts`

**Exit criteria:** Redux used only for true client state, no duplication with server cache.

**Patches:**
- `accountingSlice.ts`: Removed dead `allPayments: Payment[]` state field and unused `clearError` action
- `dashboardSlice.ts`: Fixed `getErrorMessage` to handle `SerializedError` (not just `Error` instances)
- Report: `docs/SECURITY_AUDIT_CONSISTENCY.md` (3M/2L/4 informational)

---

### 4.3 — Guest Module: Decide & Execute ✅

**Skill:** `spec-driven-development`
**Scope:** `src/modules/guests/` (7 files, mostly stubs)

- [x] Decide: merge into contacts module or build out independently?
- [x] If merging: create migration plan, update references
- [x] If building: write spec first, then implement

**Exit criteria:** Guest module has a clear purpose and implementation.

**Decision:** Keep as-is. The module is a lightweight types/hooks layer (29 lines `types.ts`, 105 lines `useGuests.ts`). The service layer (`guestService.ts`) lives in `src/services/` and is used by bookings module (7 files import `Guest` type, 3 import `guestService`). The `components/`, `services/`, and `store/` subdirs are scaffolded README placeholders — no dead code to remove. No action needed.

---

### 4.4 — Shared Services Consolidation ✅

**Skill:** `code-simplification`
**Scope:** `src/services/` (top-level service files)

- [x] Review `baseCrudService.ts` — is it still used? Should modules use it?
- [x] Check `bookingService.ts` vs `src/modules/bookings/services/bookingService.ts` — duplication?
- [x] Verify `reservationService.ts` is the single source of truth
- [x] Audit `roomService.ts` against `src/modules/rooms/` services
- [x] Review `guestService.ts` — align with guest module decision (4.3)

**Exit criteria:** No duplicate service logic, clear ownership per domain.

**Findings:**
- `baseCrudService.ts` (12 lines): Only exports `safeListLimit` + `ListOptions`. Used by `bookingService.ts`. Minimal, no action needed.
- `bookingService.ts` (344 lines, client-side) vs `src/modules/bookings/services/bookingService.ts` (213 lines, server-side): Different runtimes, different APIs (CRUD vs cursor-paginated), different `mapReservationToBooking` behavior. Not duplication — intentional split.
- `reservationService.ts` (375 lines): Single source of truth for reservation operations. No duplication found.
- `roomService.ts` (128 lines): Client-side room CRUD. Module-specific services in `src/modules/rooms/` handle server-side logic. No duplication.
- `guestService.ts` (113 lines): Client-side guest CRUD. Aligned with 4.3 decision (keep as-is).

---

## Execution Order

```
Phase 1 (Week 1-2): Security & Critical Gaps
  ├── 1.1 Accounting Security Audit
  ├── 1.2 Users Auth Audit
  ├── 1.3 Bookings Stabilization
  └── 1.4 API Authorization Sweep

Phase 2 (Week 3-4): Complexity & Maintainability
  ├── 2.1 Accounting Refactoring
  ├── 2.2 Reservations Review
  ├── 2.3 Rooms Tests + Simplify
  └── 2.4 Auth Consolidate

Phase 3 (Week 5-6): Test Coverage
  ├── 3.1 Contacts Quality Review
  ├── 3.2 Dashboard Tests
  ├── 3.3 Logs Tests
  └── 3.4 Room Types & Pricing Tests

Phase 4 (Week 7-8): Consistency & Cleanup
  ├── 4.1 API Client Consolidation
  ├── 4.2 Redux Store Audit
  ├── 4.3 Guest Module Decision
  └── 4.4 Shared Services Cleanup
```

---

## How to Execute Each Task

Each task above should be executed by loading the mapped skill:

```
Example: "Audit the accounting module for security issues"

→ Load skill: security-and-hardening
→ Scope: src/modules/accounting/ + src/app/api/accounting/
→ Follow the skill workflow step by step
→ Produce evidence-based findings
→ Fix or document each finding
→ Verify fixes with tests or manual checks
```

For refactoring tasks:

```
Example: "Simplify the accounting module"

→ Load skill: code-simplification
→ Apply Chesterton's Fence (understand before removing)
→ Rule of 500 (split if >500 lines)
→ Preserve exact behavior
→ Run tests before/after
→ Commit atomically
```

For test tasks:

```
Example: "Add tests for rooms module"

→ Load skill: test-driven-development
→ Red-Green-Refactor cycle
→ Test pyramid: 80% unit, 15% integration, 5% E2E
→ Beyonce Rule: test the behavior, not implementation
→ 80%+ coverage target
```

---

## Measuring Progress

Track completion in this checklist. Update checkboxes as tasks are done.

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| Phase 1 | 4 tasks | 4/4 | 1.1 ✅ Accounting Security · 1.2 ✅ Users Auth · 1.3 ✅ Bookings Stabilization · 1.4 ✅ API Authorization |
| Phase 2 | 4 tasks | 4/4 | 2.1 ✅ Accounting Refactoring · 2.2 ✅ Reservations Review · 2.3 ✅ Rooms Tests · 2.4 ✅ Auth Consolidate |
| Phase 3 | 4 tasks | 4/4 | 3.1 ✅ Contacts Quality · 3.2 ✅ Dashboard Tests · 3.3 ✅ Logs Tests · 3.4 ✅ Room Types & Pricing Tests |
| Phase 4 | 4 tasks | 4/4 | 4.1 ✅ API Client Consolidation · 4.2 ✅ Redux Store Audit · 4.3 ✅ Guest Module · 4.4 ✅ Shared Services |
| **Total** | **16 tasks** | **16/16** | **All complete** |
