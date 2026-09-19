# Contacts Module — Testing Plan

## Tools to Install

| Tool | Purpose | Priority |
|------|---------|----------|
| `vitest` ✅ | Already installed | — |
| `@testing-library/react` | Render React components in tests | **High** |
| `@testing-library/jest-dom` | DOM-specific matchers (`toBeInTheDocument`, etc.) | **High** |
| `@testing-library/user-event` | Simulate real user interactions | **High** |
| `happy-dom` | Lightweight DOM environment (faster than jsdom) | **High** |
| `vitest.config.ts` | Configure test environment + setup file | **High** |

No MSW or nock needed — Vitest's built-in `vi.mock()` can mock Supabase and fetch calls directly.

---

## vitest.config.ts

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
```

---

## Test Pyramid

```
        ╱  E2E (manual)  ╲        ← 1-2 smoke tests
       ╱ Integration tests ╲      ← ~18 tests (services + API routes)
      ╱  Component tests    ╲    ← ~17 tests (toolbar, table, modal)
     ╱   Unit tests (fast)    ╲  ← ~21 tests (validation, mapping, errors)
```

---

## Phase 1 — Config + Unit Tests

**Packages:** `npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event happy-dom`

### Files to create

| File | Tests |
|------|-------|
| `vitest.config.ts` | Test config with happy-dom env |
| `vitest.setup.ts` | Import `@testing-library/jest-dom` matchers |
| `src/modules/contacts/utils/contactValidation.test.ts` | `getValidContactDraft` — valid company, valid individual, missing name, invalid phone, missing country (company), missing idPassport (individual), invalid email, empty draft (8 tests) |
| `src/modules/contacts/utils/contactErrors.test.ts` | `getContactErrorDescription` — all 5 error codes + fallback (6 tests) |
| `src/modules/contacts/utils/priceOverrideLookup.test.ts` | `findOverridePrice` — match found, no match, partial match (3 tests) |
| `src/modules/contacts/services/contactService.test.ts` | `mapContactRow` — full mapping, null fields; `toContactRow` — create input, update input, partial fields (4 tests) |

**Total: 21 tests — pure functions, zero mocking needed**

---

## Phase 2 — Service Integration Tests

### Mock approach

Create a mock Supabase client factory:

```ts
// src/services/supabase/__mocks__/server.ts
export const createServerSupabaseClient = vi.fn(() => ({
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  })),
}))
```

### Files to create

| File | Tests |
|------|-------|
| `src/services/supabase/__mocks__/server.ts` | Mock `createServerSupabaseClient` |
| `src/services/supabase/__mocks__/admin.ts` | Mock `createServiceRoleSupabaseClient` |
| `src/modules/contacts/services/contactService.integration.test.ts` | `getContactById` (found, not found, error), `createContact` (success, logs activity), `updateContact`, `deleteContact`, `getContactsPage` (pagination, type filter, search), `getContactsMetrics` (15 tests) |
| `src/modules/contacts/services/priceOverrideService.integration.test.ts` | `getPriceOverrides`, `upsertPriceOverrides` (2 tests) |
| `src/modules/contacts/services/invoiceService.integration.test.ts` | `getInvoicesByContact` (1 test) |

**Total: 18 tests — Supabase mocked via vi.mock()**

---

## Phase 3 — Component Tests

### Files to create

| File | Tests |
|------|-------|
| `src/modules/contacts/components/ContactsTable.test.tsx` | Renders rows, shows logo when available, shows initial when no logo, calls onRowClick (4 tests) |
| `src/modules/contacts/components/ContactsAnalytics.test.tsx` | Shows loading skeletons, shows metric values (2 tests) |
| `src/modules/contacts/components/ContactsStates.test.tsx` | Loading state, empty state (2 tests) |
| `src/modules/contacts/components/InvoiceModal.test.tsx` | Shows details, closes on Escape, closes on overlay click, close button (3 tests) |
| `src/modules/contacts/components/PriceOverridesSection.test.tsx` | Editable inputs when canEdit, read-only when not, save button per row with changes (3 tests) |
| `src/modules/contacts/components/ContactCard.test.tsx` | Company fields, individual fields, actions menu (3 tests) |

**Total: 17 tests — needs @testing-library/react + happy-dom**

---

## Phase 4 — Hook + API Route Tests

### Files to create

| File | Tests |
|------|-------|
| `src/modules/contacts/hooks/useContactsView.test.ts` | Initial state, fetches on mount, setQuery resets pagination, nextPage, previousPage (4 tests) |
| `src/modules/contacts/hooks/useContactForm.test.ts` | openCreateForm sets mode, openEditForm populates draft, submitForm calls create, submitForm calls update (4 tests) |
| `src/app/api/contacts/contacts.test.ts` | GET returns paginated list, POST creates with CSRF, 403 on unauthorized (3 tests) |
| `src/app/api/contacts/contacts-id.test.ts` | GET by id, PATCH updates, DELETE removes (3 tests) |
| `src/app/api/contacts/contacts-analytics.test.ts` | GET returns metrics (1 test) |
| `src/app/api/contacts/contacts-price-overrides.test.ts` | GET returns overrides, PUT upserts (2 tests) |

**Total: 17 tests — hooks use renderHook, API routes mock service layer**

---

## Implementation Order

```
Day 1 — Phase 1: Config + Unit Tests
  npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event happy-dom
  Create vitest.config.ts, vitest.setup.ts
  Write 21 unit tests → npm run test passes

Day 2 — Phase 2: Service Integration Tests  
  Create Supabase __mocks__
  Write 18 integration tests → npm run test passes

Day 3 — Phase 3: Component Tests
  Write 17 component tests → npm run test passes

Day 4 — Phase 4: Hook + API Route Tests
  Write 17 hook/route tests → npm run test passes
```

---

## Key Design Decisions

1. **happy-dom over jsdom** — 2-3x faster, same DOM coverage
2. **vi.mock() over MSW** — no extra dependency, sufficient for project size
3. **Tests grouped by module** — not by file type, easy to find
4. **No E2E** — real Supabase instance makes E2E complex; manual smoke tests instead
5. **Factory functions** — create `buildContact()`, `buildInvoice()` helpers to keep tests DRY
