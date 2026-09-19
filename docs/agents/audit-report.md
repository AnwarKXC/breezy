# Security & Database Audit Report

**Generated:** 2026-05-15  
**Skills Used:** security-review, supabase-audit-rls, supabase-postgres-best-practices, supabase

---

## 1. Security Review Scan

### P0 — Fix Immediately

**No authentication on `/api/dashboard`** (`src/app/api/dashboard/route.ts:4`)
- Entire route handler has zero auth. Any unauthenticated user can access revenue, occupancy, booking counts.
- Fix: Add `authorizeRequest()` or wrap `getDashboardData()` with a permission check.

**No CSRF protection anywhere**
- All state-changing API endpoints (contacts CRUD, users CRUD, auth session) rely on cookie-based Supabase auth sessions but have no CSRF tokens, `SameSite` configuration, or `Origin`/`Referer` validation.
- Fix: Add CSRF token validation or validate `Origin`/`Referer` headers on mutating endpoints.

### P1 — High Priority

**IDOR: Logs API userId filter** (`src/app/api/logs/route.ts:108`)
- Any user with `LOGS_READ` can filter/view any other user's audit logs by `userId` query param.
- No ownership check exists.

**IDOR: Contacts/Users APIs use role-only auth**
- No resource-ownership boundary. Any user with the role permission can access any record.

### P2 — Medium Priority

- **Weak randomness fallback** in `logoUploadService.ts:13-17`: `Math.random()` used when `crypto.randomUUID()` unavailable
- **No rate limiting** on auth/login endpoints — no brute-force protection at app layer
- **No security headers** (CSP, HSTS, X-Frame-Options) in `next.config.ts`

---

## 2. RLS Audit (supabase-audit-rls)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | **P1** | `company_price_overrides` SELECT policy reuses `can_read_contacts()` — misleading coupling; a future change to contacts access would silently affect pricing data | Create dedicated `private.can_read_company_price_overrides()` function |
| 2 | **P2** | `can_read_logs()` is admin-only. Front desk & accountant fully locked out of audit trail | If non-admins need audit visibility, add module-based filtering |
| 3 | **P3** | Accountant cannot read `rooms`, `contacts`, or `company_price_overrides` | Verify business requirements — may need read access for financial auditing |

**Verified:** All 7 tables have RLS enabled. All SECURITY DEFINER functions properly scoped. No `USING(true)` policies in final state. Audit_logs correctly append-only.

---

## 3. Postgres Schema Issues (Best Practices)

### CRITICAL — Type Mismatches

| Issue | File | Fix |
|-------|------|-----|
| `bookings.guest_id` is `text` but `guests.id` is `uuid` | `20260511222525_initial_app_schema.sql:61` | Alter to `uuid` + add FK constraint |
| `bookings.room_id` is `text` but `rooms.id` is `uuid` | `20260511222525_initial_app_schema.sql:63` | Alter to `uuid` + add FK constraint |

No FK enforcement means orphaned booking references possible.

### HIGH — Missing Indexes

- **No index on `bookings.room_id`** — every query filtering bookings by room does a seq scan
- **No compound `(check_in, check_out)` index** — availability overlap queries will be slow

### MEDIUM

- **No uniqueness constraint** on `company_price_overrides(contact_id, room_category, occupancy_code)` — duplicate overrides possible
- **`guests.total_bookings` / `total_spent` are denormalized** with no sync trigger — will drift from actual booking data

---

## 4. Quick Wins (Low Effort)

| Fix | File |
|-----|------|
| Add `paid_amount <= total_amount` CHECK on bookings | `20260511222525_initial_app_schema.sql` |
| Convert `audit_logs.external_firebase_id` UNIQUE to partial index (nullable) | `20260511222525_initial_app_schema.sql:45` |
| Add CHECK constraints for company vs individual contact fields | `20260514000000_add_contacts_and_price_overrides.sql` |
| Add CSP + security headers in Next.js config | `next.config.ts` |
| Add rate limiting to auth endpoints | `src/services/auth/` |

---

## Top 3 Priorities

1. **Add auth to `/api/dashboard`** — currently completely exposed
2. **Fix `bookings.guest_id` and `bookings.room_id` type mismatches** (`text` → `uuid`) — no referential integrity
3. **Add CSRF protection** on state-changing API endpoints
