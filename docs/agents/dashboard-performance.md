Performance Review After Every New Feature or Module
Use this file after completing any new feature, module, refactor, dashboard update, Supabase schema change, RLS policy change, or major UI change.
Goal: prevent performance regressions before merging code.

---

When to Run This
Run this review after changes to any of these areas:
New page or route
New module
Dashboard widgets
Data tables
Forms with heavy validation
Supabase queries
Supabase migrations
RLS policies
Server Actions
API routes
Search/filter/pagination
Charts or reports
File uploads
Auth or role-based logic
Shared components
Refactors that move data fetching or UI rendering

---

Required Agent Skills
Before starting, use any installed relevant skills:

```txt
Use next-best-practices.
Use vercel-react-best-practices.
Use supabase-postgres-best-practices.
Use performance.
Use security-review if the change touches auth, roles, RLS, or private data.
```

If available, also use:

```txt
Use sentry-nextjs-sdk if production tracing or monitoring is configured.
```

---

Performance Review Prompt
Copy this prompt into your coding agent after each new feature/module:

```txt
Review the latest feature/module for performance regressions.

Scope:
- Inspect the files changed in the current Git diff.
- Inspect related parent routes, layouts, shared components, hooks, Supabase queries, Server Actions, API routes, migrations, and RLS policies.
- Do not rewrite the feature unless a clear performance issue is found.
- Prefer small, safe fixes over large refactors.

Use these skills if installed:
- next-best-practices
- vercel-react-best-practices
- supabase-postgres-best-practices
- performance
- security-review if auth, roles, RLS, or sensitive data is involved

Check these areas:

1. Next.js App Router performance
   - Server Component vs Client Component boundaries
   - unnecessary `use client`
   - slow layouts
   - blocking data fetching
   - missing `loading.tsx` or Suspense boundaries
   - unnecessary dynamic rendering
   - bad caching/revalidation choices
   - route handlers that duplicate server logic

2. React performance
   - unnecessary re-renders
   - expensive calculations inside render
   - unnecessary state
   - unnecessary effects
   - duplicated fetches
   - unstable props causing child re-renders
   - heavy components loaded too early
   - large tables/lists without pagination or virtualization

3. Supabase/Postgres performance
   - missing indexes
   - slow joins
   - N+1 queries
   - fetching too many rows/columns
   - missing pagination
   - expensive search/filter logic
   - slow RLS policies
   - RLS columns without indexes
   - repeated queries that should be batched or moved into an RPC
   - dashboard queries that should use summary tables/views

4. Auth and role performance
   - repeated role lookups
   - role checks happening only on the client
   - RLS policies calling expensive functions repeatedly
   - policies that scan tables unnecessarily
   - missing indexes on `user_id`, `hotel_id`, `organization_id`, `role`, or ownership columns

5. Bundle size
   - large libraries imported into Client Components
   - chart/table/date libraries imported on initial load
   - server-only code accidentally imported into client code
   - shared components pulling heavy dependencies
   - icons imported inefficiently
   - components that should be dynamically imported

6. Network and API behavior
   - too many sequential requests
   - duplicated requests
   - missing parallelization
   - over-fetching data
   - no pagination or limit
   - slow file/image loading
   - missing caching where safe

7. Dashboard-specific checks
   - KPI cards should not each trigger separate slow queries if they can be batched
   - dashboard should not fetch full tables just to count records
   - charts should fetch aggregated data, not raw rows
   - tables must paginate
   - search should debounce if client-driven
   - heavy dashboard widgets should lazy-load when possible

8. Forms and mutations
   - validation should not be duplicated or expensive
   - submit actions should avoid unnecessary refetches
   - optimistic UI should only be used where safe
   - mutations should return only needed data
   - file uploads should not block unrelated UI

9. Images, fonts, and assets
   - use optimized images where applicable
   - avoid loading large images in dashboards
   - avoid unnecessary custom fonts or weights
   - avoid layout shift from media

10. Tests and regression protection
   - add or update tests for performance-sensitive logic
   - add tests for pagination/search behavior if relevant
   - ensure auth/role behavior does not cause extra data access
   - ensure no flaky async tests were introduced

Output format:

1. Performance summary
2. Top issues found, ordered by impact
3. Files inspected
4. Supabase queries inspected
5. Missing indexes or database changes recommended
6. RLS performance risks
7. Client bundle risks
8. Rendering/re-render risks
9. Safe fixes applied
10. Risky fixes not applied
11. Commands executed
12. Before/after measurements if available
13. Remaining risks
14. Merge recommendation: PASS / PASS WITH RISKS / BLOCK
```

---

Required Commands
Run the commands that exist in the project. Do not invent scripts without checking `package.json` first.

1. Check Changed Files

```bash
git status --short
git diff --stat
git diff --name-only
```

2. Typecheck
   Use the existing project script, for example:

```bash
pnpm typecheck
```

or:

```bash
npm run typecheck
```

3. Lint

```bash
pnpm lint
```

or:

```bash
npm run lint
```

4. Tests

```bash
pnpm test:run
```

or:

```bash
npm run test:run
```

5. Production Build

```bash
pnpm build
```

or:

```bash
npm run build
```

6. Bundle Analysis
   If bundle analyzer is installed, run:

```bash
ANALYZE=true pnpm build
```

or:

```bash
ANALYZE=true npm run build
```

Check for:
unexpectedly large client bundles
heavy dashboard chunks
heavy shared component chunks
large chart/table libraries
duplicate dependencies

---

Supabase Performance Checks
Run these checks when the feature touches Supabase queries, schema, migrations, RLS, users, contacts, dashboards, reports, reservations, payments, or roles.

1. Inspect Queries
   For every new or changed Supabase query, check:

```txt
- Does it select only needed columns?
- Does it use `.limit()` or pagination?
- Does it filter by indexed columns?
- Does it avoid loading full tables?
- Does it avoid N+1 patterns?
- Does it avoid sequential queries when safe parallel queries are possible?
```

Bad example:

```ts
const { data } = await supabase.from("contacts").select("*");
```

Better example:

```ts
const { data } = await supabase
  .from("contacts")
  .select("id, name, type, phone, email, created_at")
  .eq("hotel_id", hotelId)
  .order("created_at", { ascending: false })
  .range(0, 24);
```

2. Check Indexes
   For common hotel/dashboard tables, verify indexes on columns like:

```txt
profiles.user_id
profiles.role
contacts.user_id
contacts.hotel_id
contacts.organization_id
contacts.type
contacts.email
contacts.phone
contacts.created_at
bookings.hotel_id
bookings.guest_id
bookings.status
bookings.check_in
bookings.check_out
rooms.hotel_id
rooms.status
payments.booking_id
payments.status
invoices.booking_id
invoices.status
```

Do not add indexes blindly. Recommend indexes based on actual query filters, joins, ordering, and RLS policies. 3. Check RLS Performance
For RLS policies, check:

```txt
- Are ownership columns indexed?
- Are role lookup columns indexed?
- Are policies using expensive subqueries?
- Are policies repeatedly calling auth functions?
- Are policies causing full table scans?
- Can role checks be simplified or moved to helper functions safely?
```

Important ownership columns often include:

```txt
user_id
profile_id
hotel_id
organization_id
tenant_id
created_by
assigned_to
```

4. Explain Analyze for Critical Queries
   For any suspicious slow query, ask the agent to produce an `EXPLAIN ANALYZE` version that can be tested locally or in Supabase SQL editor.
   Example:

```sql
explain analyze
select id, name, email, phone, created_at
from contacts
where hotel_id = 'REPLACE_WITH_HOTEL_ID'
order by created_at desc
limit 25;
```

## Never run destructive SQL during performance review.

Dashboard Performance Rules
A dashboard should follow these rules:

```txt
- Do not fetch full tables just to calculate counts.
- Do not run one query per KPI card if a single aggregated query/RPC can return all KPI values.
- Do not fetch chart data as raw rows if aggregation can happen in SQL.
- Do not load heavy charts before they are visible if not needed above the fold.
- Do not make the whole dashboard a Client Component unless necessary.
- Do not block the entire page on slow optional widgets.
- Use Suspense/loading boundaries for slow sections.
- Paginate tables.
- Debounce search input when it triggers requests.
```

Preferred dashboard data pattern:

```txt
Server Component page
  -> fetch critical summary data
  -> render fast KPI cards
  -> Suspense for slow widgets
  -> paginated tables
  -> dynamic import for heavy charts
```

---

Performance Budgets
Use these as default targets unless the project has stricter budgets.

```txt
Production build: must pass
Typecheck: must pass
Lint: must pass
Unit/integration tests: must pass
Dashboard initial client JS: should not grow unexpectedly
Large table pages: must paginate
Dashboard data queries: should avoid N+1
Critical Supabase queries: should use indexes
RLS policies: should not require full table scans for common access
```

For Lighthouse or real-user monitoring:

```txt
LCP: aim for under 2.5s
INP: aim for under 200ms
CLS: aim for under 0.1
```

## Treat these as goals, not automatic blockers during early development unless the regression is severe.

Optional Tooling To Install
Install only if not already present and if the project needs it.
Next.js Bundle Analyzer

```bash
pnpm add -D @next/bundle-analyzer
```

Lighthouse CI

```bash
pnpm add -D @lhci/cli
```

Sentry for Next.js Performance Tracing

```bash
npx @sentry/wizard@latest -i nextjs
```

Supabase/Postgres Extensions
Enable only in an environment where this is allowed:

```sql
create extension if not exists pg_stat_statements;
create extension if not exists hypopg;
```

---

Required Final Report
After every performance review, the agent must report exactly this:

```txt
# Performance Review Report

## 1. Result
PASS / PASS WITH RISKS / BLOCK

## 2. Summary
Short summary of performance health.

## 3. Files Inspected
- ...

## 4. Commands Executed
- ...

## 5. Measurements
- Build result:
- Bundle notes:
- Test result:
- Query notes:
- Lighthouse/Core Web Vitals if available:

## 6. High-Impact Issues
1. ...
2. ...
3. ...

## 7. Fixes Applied
- ...

## 8. Recommended Indexes or SQL Changes
- ...

## 9. RLS/Auth Performance Risks
- ...

## 10. Client Rendering Risks
- ...

## 11. Remaining Risks
- ...

## 12. Next Recommendation
What should be checked or improved next.
```

---

Stop Rule
Do not continue into large rewrites automatically.
If a performance issue requires a large refactor, stop and report:

```txt
Large performance refactor recommended.
Reason:
Risk:
Files affected:
Suggested safe migration plan:
```

## Then wait for approval before making the large refactor.

Quick Agent Command
Use this short version when you want a fast review:

```txt
Run PERFORMANCE_REVIEW_AFTER_FEATURE.md on the latest Git diff. Focus on slow dashboard behavior, Supabase query performance, RLS performance, bundle size, unnecessary Client Components, and missing pagination/indexes. Apply only safe fixes. Report using the required final report format.
```
