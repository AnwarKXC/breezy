# Accounting Module — Security Audit Report

> **Scope:** `src/modules/accounting/`, `src/app/api/accounting/`
> **Date:** 2026-08-29
> **Skill:** security-review
> **Auditor:** OpenCode Agent

---

## Findings Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 HIGH | 0 | — |
| 🟡 MEDIUM | 4 | See below |
| 🔵 LOW | 3 | See below |
| ⚪ INFO | 2 | See below |

**Overall Assessment:** The accounting module has a solid security foundation. All API routes use the `secureEndpoint` wrapper (auth + CSRF + rate limiting), all service methods enforce RBAC via `serviceSecurity.ts`, input validation uses Zod, and no hardcoded secrets or injection vulnerabilities were found. The issues below are defense-in-depth improvements, not active exploits.

---

## What's Working Well

1. **Authorization:** Every API route wraps handlers in `secureReadEndpoint` or `secureMutationEndpoint`, which checks `authorizeRequest` → `canPerformAction` before execution. Every service method calls the appropriate `require*()` function.

2. **CSRF Protection:** All mutation endpoints go through `validateCsrf` via `secureMutationEndpoint`.

3. **Rate Limiting:** Applied at READ (100/min) and MUTATION (30/min) tiers.

4. **Input Validation:** All API routes parse input through Zod schemas (`AccountingInvoiceCreateSchema`, `AccountingPaymentCreateSchema`, etc.) before passing to services.

5. **No Secrets/Injection:** No hardcoded credentials, no `eval()`, no `dangerouslySetInnerHTML`, no raw SQL strings.

6. **Server-only:** All service files import `'server-only'`, preventing client-side bundling.

7. **Soft Deletes:** Consistent `deleted_at` pattern prevents data loss.

---

## Findings

### 🟡 MEDIUM-1: Service Role Client Bypasses RLS on Read Operations

**Files:**
- `src/modules/accounting/services/accountingService.ts` (lines 208, 264, 312, 568, 644, 731, 914, 1001, 1129, 1173, 1243, 1333)
- `src/modules/accounting/services/invoiceService.ts` (lines 35, 114, 321, 419, 506, 561, 591, 635, 676, 773, 917)
- `src/modules/accounting/services/paymentService.ts` (lines 51, 98, 126, 142, 202)

**Description:** The accounting module uses `createServiceRoleSupabaseClient()` for **all** database operations — including read-only queries like `getInvoices`, `getPaymentsByInvoice`, `getExpenses`, `getLedgerEntries`. The service role key bypasses Row Level Security (RLS). While RBAC is enforced at the application layer via `serviceSecurity.ts`, this creates a defense-in-depth gap: if RBAC has a bug, RLS won't catch it because the service role client skips RLS entirely.

**Risk:** A missing or incorrect `require*()` call in a new service function would grant unrestricted database access.

**Recommendation:** Use `createServerSupabaseClient()` (user-scoped, respects RLS) for read operations. Reserve `createServiceRoleSupabaseClient()` for write operations that need to modify rows the user doesn't own (e.g., updating related records in a cascade).

**Confidence:** Medium — the RBAC layer appears comprehensive, so this is a defense-in-depth concern, not an active vulnerability.

---

### 🟡 MEDIUM-2: `Math.random()` for Financial Transaction Numbers

**Files:**
- `src/modules/accounting/services/ledgerService.ts:18`
- `src/modules/accounting/services/accountingService.ts:1586`

**Vulnerable Code:**
```typescript
const txNumber = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
```

**Description:** Transaction numbers for ledger entries use `Math.random()`, which is not cryptographically secure and has ~36^4 = 1.6M possible suffixes. Under high throughput, collisions are possible. While these are reference numbers (not auth tokens), duplicate transaction numbers in a financial ledger could cause confusion during reconciliation or audit.

**Risk:** Transaction number collisions under load. Not a security breach, but a data integrity concern for financial records.

**Recommendation:** Use `crypto.randomUUID()` or a database-sequence-based approach for guaranteed uniqueness:

```typescript
// Before
const txNumber = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

// After
import { randomUUID } from 'crypto'
const txNumber = `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`
```

**Confidence:** High — this is a straightforward fix.

---

### 🟡 MEDIUM-3: Raw Supabase Error Messages Exposed to Clients

**Files:**
- `src/modules/accounting/services/accountingService.ts` (lines 184, 202, 217, 227, 254, 323, 336, 378, 397, 410, 422, 437, 439, 471, 492, 525, 541, 555, 609, 725, 790, 798, 858, 860, 879, 903, 975, 982, etc.)
- `src/modules/accounting/services/invoiceService.ts` (similar pattern)
- `src/modules/accounting/services/paymentService.ts` (lines 27, 45, 60, 71, 88, 105, 118, 137, 149, 157, 187, 198, 213)

**Vulnerable Code:**
```typescript
if (error) throw new Error(error.message)
```

**Description:** Supabase error objects contain database-level details (column names, table names, constraint names, sometimes query details). These are propagated through `throw new Error(error.message)` and ultimately returned to the client via API error responses. An attacker could use these messages to infer database schema.

**Risk:** Information disclosure of internal database structure. Low direct exploitation risk, but aids reconnaissance.

**Recommendation:** Map Supabase errors to generic messages at the service boundary:

```typescript
// Before
if (error) throw new Error(error.message)

// After
if (error) {
  console.error('Supabase error:', error.message, error.code)
  throw new Error('Failed to fetch invoices')
}
```

**Confidence:** High — this is a common hardening pattern.

---

### 🟡 MEDIUM-4: Unscoped `deleteInvoice` Cascade

**File:** `src/modules/accounting/services/accountingService.ts:1171-1239`

**Description:** The `deleteInvoice` function cascades soft-deletes to `reservations`, `reservation_rooms`, and `reservation_guests` when the invoice has a `reservation_id`. This is an admin-only destructive action, but the cascade means deleting an invoice for an active reservation would silently soft-delete the reservation and release its rooms.

**Risk:** Accidental data loss if an admin deletes an invoice linked to an active reservation without realizing the cascade.

**Recommendation:** Add a guard that refuses to delete invoices linked to non-cancelled/non-checked-out reservations, or at minimum warn the caller:

```typescript
// Add before the cascade
if (invoice.reservation_id) {
  const { data: reservation } = await supabase
    .from('reservations')
    .select('status')
    .eq('id', invoice.reservation_id)
    .single()
  
  if (reservation && !['cancelled', 'checked_out', 'no_show'].includes(reservation.status)) {
    throw new Error('Cannot delete an invoice linked to an active reservation. Cancel or check out the reservation first.')
  }
}
```

**Confidence:** High — this is a business logic guard, not a security fix.

---

### 🔵 LOW-1: In-Memory Rate Limiter Doesn't Work Across Serverless Instances

**File:** `src/shared/rateLimit.ts:7`

**Description:** The rate limiter uses a `Map<string, ...>` which is per-process. In a serverless/edge deployment (Vercel, Cloudflare Workers), each invocation has its own memory space, making the rate limit ineffective.

**Risk:** Rate limiting may not be enforced in production if running on serverless infrastructure.

**Recommendation:** Use an external store (Redis, Supabase edge function, or Vercel's built-in rate limiting) for production.

**Confidence:** High — this is a known limitation of in-memory rate limiting.

---

### 🔵 LOW-2: Duplicate Service Logic (accountingService.ts vs invoiceService.ts)

**Files:**
- `src/modules/accounting/services/accountingService.ts` (1600+ lines)
- `src/modules/accounting/services/invoiceService.ts` (934 lines)

**Description:** Both files contain `getInvoices`, `getInvoiceById`, `createInvoice`, `updateInvoice`, `issueInvoice`, `voidInvoice`, `deleteInvoice`, `refundInvoice`, and `getNextInvoiceNumber`. The implementations differ slightly (e.g., `invoiceService.ts:deleteInvoice` checks for payments before deleting, while `accountingService.ts:deleteInvoice` cascades to reservations). This creates inconsistency risk.

**Risk:** Security-relevant logic (like authorization checks or validation) could drift between the two files.

**Recommendation:** Consolidate into a single canonical service. The `invoiceService.ts` version appears more defensive (checks for payments before delete). Mark the other as deprecated or remove it.

**Confidence:** High — this is a maintainability concern.

---

### 🔵 LOW-3: Export Endpoint Passes Unvalidated Type to Switch

**File:** `src/modules/accounting/services/exportService.ts:11-30`

**Description:** The `getExportData` function accepts a `type` string and switches on it. Unknown types throw a generic error. The function is behind `requireAccountingExport()` RBAC, so this is low risk, but the unvalidated `params` passthrough could pass unexpected query parameters to downstream functions.

**Risk:** Low — RBAC-gated, and the switch statement limits the attack surface.

**Recommendation:** Validate the `type` parameter against a known enum and validate `params` per export type.

**Confidence:** High.

---

### ⚪ INFO-1: `createServiceRoleSupabaseClient` Cached at Request Scope

**File:** `src/services/supabase/admin.ts:10`

**Description:** The service role client is wrapped in `cache()` from React, meaning it's reused within a single request. This is correct behavior and not a vulnerability — just noting it for awareness.

---

### ⚪ INFO-2: No TODO/FIXME/HACK Comments Found

The accounting module (and entire codebase) has zero TODO/FIXME/HACK markers, indicating either disciplined cleanup or hidden technical debt that isn't documented.

---

## Patches

### Patch 1: Fix Math.random() in ledgerService.ts

```typescript
// BEFORE (ledgerService.ts:18)
const txNumber = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

// AFTER
import { randomUUID } from 'crypto'
const txNumber = `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`
```

### Patch 2: Fix Math.random() in accountingService.ts

```typescript
// BEFORE (accountingService.ts:1586)
const txNumber = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

// AFTER
import { randomUUID } from 'crypto'
const txNumber = `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`
```

### Patch 3: Add reservation status guard to deleteInvoice

```typescript
// BEFORE (accountingService.ts:1218)
if (invoice.reservation_id) {
  await supabase
    .from('reservations')
    .update({ deleted_at: nowIso })
    .eq('id', invoice.reservation_id)
    .is('deleted_at', null)
  // ... cascade continues

// AFTER
if (invoice.reservation_id) {
  const { data: reservation } = await supabase
    .from('reservations')
    .select('status')
    .eq('id', invoice.reservation_id)
    .is('deleted_at', null)
    .single()

  if (reservation && !['cancelled', 'checked_out', 'no_show', 'released'].includes(reservation.status)) {
    throw new Error('Cannot delete an invoice linked to an active reservation. Cancel or check out the reservation first.')
  }

  await supabase
    .from('reservations')
    .update({ deleted_at: nowIso })
    .eq('id', invoice.reservation_id)
    .is('deleted_at', null)
  // ... cascade continues
```

### Patch 4: Sanitize error messages in service methods

Apply this pattern across all service files:

```typescript
// BEFORE (repeated pattern)
if (error) throw new Error(error.message)

// AFTER
if (error) {
  console.error(`[accounting] ${functionName} failed:`, error.code, error.message)
  throw new Error(`Failed to ${operation}`)
}
```

**Review each patch before applying. Nothing has been changed yet.**

---

## Next Steps

1. **Apply patches 1-3** (Math.random fix + reservation guard) — these are safe, targeted changes
2. **Patch 4** (error sanitization) — bulk change across ~60 locations, do in a dedicated commit
3. **Address MEDIUM-1** (service role client) — requires careful testing of read operations with user-scoped client
4. **Address LOW-2** (duplicate services) — consolidate in a separate refactoring task

---

*Report generated by security-review skill. Re-audit after applying patches.*
