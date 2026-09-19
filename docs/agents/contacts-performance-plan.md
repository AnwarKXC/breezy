# Hotel System — Performance Testing Plan

## 1. Scope & Targets

| Metric | Target | Tool |
|--------|--------|------|
| First Contentful Paint (FCP) | < 1.8s | Lighthouse, Web Vitals |
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse, Web Vitals |
| Interaction to Next Paint (INP) | < 200ms | Lighthouse, Web Vitals |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse, Web Vitals |
| Total Blocking Time (TBT) | < 200ms | Lighthouse |
| Time to First Byte (TTFB) | < 800ms | Lighthouse, curl |
| API response time (p95) | < 500ms | k6, custom logs |
| SSR interactivity | < 2s | `next build --debug` |

---

## 2. Tools & Setup

```bash
# Infrastructure
npm install -D lighthouse @next/bundle-analyzer web-vitals

# Load testing (run locally, not a CI dependency)
# Install k6 from https://grafana.com/docs/k6/latest/set-up/

# React profiling
npm install -D @welldone-software/why-did-you-render
```

### Bundle analyzer setup

Add to `next.config.ts`:

```ts
import type { NextConfig } from "next";

const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? (await import('@next/bundle-analyzer')).default({ enabled: true })
  : (config: NextConfig) => config

const nextConfig: NextConfig = {
  // ... existing config
}

export default withBundleAnalyzer(nextConfig)
```

---

## 3. Test Scenarios

### 3.1 Lighthouse Audits

Run against a **production build** (`npm run build && npm start`) for each scenario:

| Scenario | Route | Conditions | Focus Metrics |
|----------|-------|------------|---------------|
| First load (cold) | `/` → `/en` | Clear cache, Slow 3G | LCP, TBT, TTFB, weight |
| Login page | `/en/login` | Unauthenticated | FCP, CLS |
| Dashboard load | `/en/dashboard` | Auth admin | LCP, TTFB, JS size |
| Contacts list | `/en/contacts` | 50+ contacts | LCP, INP |
| Contact detail | `/en/contacts/{id}` | Data loaded | LCP, CLS |
| Settings page | `/en/settings` | Minimal data | FCP, CLS |

```bash
# Single run
npx lighthouse http://localhost:3000/en/contacts --output html --output-path reports/lh-contacts.html --preset desktop

# 3-run median
for i in 1 2 3; do
  npx lighthouse http://localhost:3000/en/dashboard \
    --output json \
    --output-path reports/lh-dashboard-$i.json \
    --preset desktop
done
```

### 3.2 Bundle Size Analysis

```bash
ANALYZE=true npm run build
```

**Key modules to track:**

| Module | Current (est.) | Budget |
|--------|----------------|--------|
| `next` (runtime) | ~200KB gzip | < 250KB |
| `@supabase/supabase-js` | ~35KB gzip | < 40KB |
| `@reduxjs/toolkit` + `react-redux` | ~25KB gzip | < 30KB |
| `jspdf` + `jspdf-autotable` | ~150KB gzip | **High** — lazy load |
| `zod` | ~15KB gzip | < 20KB |
| Poppins font (6 weights) | ~60KB + preload | **High** — consider variable font |
| Total page JS | < 300KB gzip | < 300KB |

### 3.3 API Performance Tests (k6)

Create `k6-tests/contacts-api.js`:

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const res = http.get('http://localhost:3000/api/contacts?limit=20', {
    headers: { Authorization: 'Bearer TEST_TOKEN' },
  })
  check(res, { 'status 200': (r) => r.status === 200 })
  sleep(1)
}
```

Create `k6-tests/dashboard-api.js`:

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
  },
}

export default function () {
  const res = http.get('http://localhost:3000/api/dashboard', {
    headers: { Authorization: 'Bearer TEST_TOKEN' },
  })
  check(res, { 'status 200': (r) => r.status === 200 })
  sleep(3)
}
```

**Critical API endpoints:**

| Endpoint | Method | Expected Load | Notes |
|----------|--------|---------------|-------|
| `/api/contacts` | GET | High (list) | Test cursor pagination |
| `/api/contacts/{id}` | GET | Medium | |
| `/api/dashboard` | GET | High (every load) | **7 concurrent Supabase queries** |
| `/api/contacts/analytics` | GET | Medium | 3 concurrent count queries |
| `/api/logs` | GET | Medium | |
| `/api/users` | GET | Medium | Paginated list |

### 3.4 Runtime / Rendering Performance

Tests to record in browser DevTools Performance panel:

| Test | Method | What to measure |
|------|--------|-----------------|
| Page navigation | Performance panel recording | Navigation start → Interactive time |
| Contacts list/grid toggle | Performance panel recording | Layout thrash, reflow count |
| Contact search (debounced typing) | Performance panel recording | Input latency, React render time |
| Table scroll (50 rows) | `content-visibility` check | Frame rate |
| Modal open/close | React DevTools profiler | Commit count, mount time |
| Dashboard data load | Performance panel recording | Loading state sequence |

### 3.5 Web Vitals Real-User Monitoring

Create `src/components/WebVitalsReporter.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals'

export function WebVitalsReporter() {
  useEffect(() => {
    onLCP(console.debug)
    onINP(console.debug)
    onCLS(console.debug)
    onFCP(console.debug)
    onTTFB(console.debug)
  }, [])
  return null
}
```

Add to root layout:

```tsx
// src/app/layout.tsx
import { WebVitalsReporter } from '@/components/WebVitalsReporter'

// inside <body>:
<WebVitalsReporter />
```

---

## 4. Performance Hotspots to Investigate

Based on architecture analysis of the codebase:

| # | Area | Risk | Rationale |
|---|------|------|-----------|
| 1 | **Dashboard API** | High | 7 sequential-ish Supabase count queries every load |
| 2 | **Poppins font loading** | High | 6 font weights → large woff2 files, impacts LCP |
| 3 | **Redux Provider wrapping entire app** | Medium | Entire tree marked client; no RSC interop |
| 4 | **jsPDF bundle size** | Medium | ~150KB gzip, imported in multiple export modules |
| 5 | **Auth check = overhead per API call** | Medium | Every API route calls `getCurrentServerSession()` which awaits Supabase cookie query |
| 6 | **AOSInit animation scan** | Low | `querySelectorAll('[data-aos]')` scans entire DOM |
| 7 | **i18n JSON loading** | Medium | ~5-10KB per locale, both locales loaded |
| 8 | **Sidebar/Navbar/BottomNav client-rendered** | Medium | Navigation components block streaming |
| 9 | **Contacts page dynamic import** | Low | Already using `dynamic()` correctly |
| 10 | **Supabase cookie + auth handling** | Medium | `cookies()` call in SSR adds to TTFB |

### Detailed investigation notes

**Hotspot 1 — Dashboard API:**
```ts
// src/modules/dashboard/services/dashboardService.ts
const [totalUsers, activeBookings, availableRooms, totalRooms, checkIns, checkOuts, revenueResult] = await Promise.all([
  supabase.from('profiles').select('id', { count: 'exact', head: true }),
  supabase.from('bookings').select('id', { count: 'exact', head: true }),
  supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('status', 'available'),
  // + 4 more concurrent queries
])
```
These 7 queries run via `Promise.all`, so they execute concurrently. But they all count rows on potentially large tables. Measure execution time at scale.

**Hotspot 3 — Redux provider wrap:**
```tsx
// src/store/provider.tsx
'use client'
export function ReduxProvider({ children }) {
  return <Provider store={store}>{children}</Provider>
}
```
The entire app tree below ReduxProvider is client-rendered. Consider colocating Redux only to pages that actually use it, keeping layout/server components outside the provider boundary.

---

## 5. Test Execution Steps

```
Step 1: Establish baseline
  ├── 1a. Production build
  ├── 1b. Lighthouse reports (3 key routes)
  ├── 1c. TTFB measurements
  └── 1d. Bundle size snapshot

Step 2: Deep diagnostics
  ├── 2a. Frontend (Performance panel, Coverage, React Profiler, Network)
  ├── 2b. Backend (Supabase query analysis, k6 load tests, DB pool)
  └── 2c. Compare against budgets

Step 3: Optimize (priority order)
  ├── 3a. Dashboard API caching
  ├── 3b. Poppins → variable font
  ├── 3c. jsPDF dynamic import
  ├── 3d. Redux boundary colocation
  ├── 3e. Contacts API optimizations
  ├── 3f. Font display strategy
  └── 3g. Perf logging removal

Step 4: Verify & gate
  ├── 4a. Re-run all baseline measurements
  ├── 4b. Compare before/after
  └── 4c. Set CI regression thresholds
```

### Step 1: Establish Baseline

```bash
# 1a. Production build + start
npm run build
npm start &

# 1b. Lighthouse on 3 key routes
npx lighthouse http://localhost:3000/en/login \
  --output json --output-path reports/baseline/login.json
npx lighthouse http://localhost:3000/en/dashboard \
  --output json --output-path reports/baseline/dashboard.json
npx lighthouse http://localhost:3000/en/contacts \
  --output json --output-path reports/baseline/contacts.json

# 1c. TTFB measurements
curl -o /dev/null -s -w "TTFB: %{time_starttransfer}\nTotal: %{time_total}\n" \
  http://localhost:3000/en/contacts
curl -o /dev/null -s -w "TTFB: %{time_starttransfer}\n" \
  http://localhost:3000/api/contacts

# 1d. Bundle size
du -sh .next/static/chunks/
ls -la .next/static/chunks/app/
```

### Step 2: Deep Diagnostics

**Frontend:**
- DevTools Performance panel: record `/en/contacts` load + interaction
- DevTools Coverage panel: identify unused JS/CSS
- React DevTools Profiler: profile contacts table re-renders
- Network panel: sort by size, identify large JS chunks

**Backend:**
- Supabase query profiling: enable `pg_stat_statements` in Supabase dashboard
- API route profiling: add request duration logging to slow routes
- k6 load tests: `k6 run k6-tests/contacts-api.js`
- Database connection pool: check Supabase connection limits and pool utilization

### Step 3: Optimize (Priority Order)

| # | Optimization | Expected Impact | Verification |
|---|-------------|-----------------|--------------|
| 1 | Dashboard API: add in-memory cache (TTL 60s) | 3-5x TTFB reduction | curl + Lighthouse |
| 2 | Poppins → variable font (1 file replaces 6) | ~50KB reduction in font weight | Network tab |
| 3 | jsPDF: `dynamic(() => import('jspdf'))` | ~150KB reduction in main bundle | Bundle analyzer |
| 4 | Co-locate Redux provider to dashboard only | Less initialization JS | Performance panel |
| 5 | Contacts API: add `!limit` short-circuit in `select` | Fewer wasteful count queries | k6 p95 |
| 6 | Compress i18n JSON → native ES imports | Faster parse time | Lighthouse |
| 7 | Use `font-display: optional` on custom font | Eliminate FOIT | Lighthouse CLS |
| 8 | Add `suppressHydrationWarning` to Sidebar/Navbar | Faster interaction | INP |

### Step 4: Regression Gates

A CI check that fails if:

```bash
# Lighthouse performance score < 80
# Any module bundle size > budget + 5%
# API p95 > 800ms under 50 concurrent users
# TBT > 300ms on any measured route
# LCP > 3.0s on desktop
```

---

## 6. Deliverables Checklist

- [ ] `reports/baseline/` — JSON Lighthouse reports and API latency baselines
- [ ] `k6-tests/contacts-api.js` — Contacts API load test
- [ ] `k6-tests/dashboard-api.js` — Dashboard API load test
- [ ] `reports/bundle/` — Bundle analyzer HTML output
- [ ] `PERF_LOG.md` — Optimization log with before/after measurements
- [ ] `.github/workflows/perf.yml` (optional) — Scheduled CI performance check

---

## 7. Time Estimate

| Phase | Est. Duration |
|-------|---------------|
| Setup & tooling | 30 min |
| Baseline measurements (Lighthouse + bundle + API) | 1 hr |
| Deep diagnostics (React profiler, k6, Supabase queries) | 2 hr |
| Optimizations (3-5 items by priority) | 3-4 hr |
| Re-verify (before/after comparison) | 1 hr |
| **Total** | **7.5–8.5 hr** |

---

## 8. Performance Budget Table

| Resource | Budget | Rationale |
|----------|--------|-----------|
| Total page weight | < 1.5 MB | 3G loads in ~4s |
| JavaScript (compressed) | < 300 KB | Parsing + execution time |
| CSS (compressed) | < 100 KB | Render blocking |
| Images (above-fold) | < 500 KB | LCP impact |
| Fonts | < 100 KB | FOIT/FOUT prevention |
| Third-party | < 200 KB | Uncontrolled latency |
| Lighthouse Performance score | > 85 | Baseline for good UX |
| API p95 response time | < 500 ms | User-perceived latency |
