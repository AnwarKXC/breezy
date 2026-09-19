# Performance Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce bundle size, eliminate cascading re-renders, deduplicate data fetching, optimize DOM rendering, and make server-side operations non-blocking.

**Architecture:** Surgical changes across 5 areas — bundle/code-splitting, Redux selectors, data fetching/caching, rendering/DOM, and server-side perf. Each task independently verifiable via `pnpm build` and `pnpm lint`.

**Tech Stack:** Next.js 16, React 19, Redux Toolkit 2.11, Supabase SSR, TypeScript 5

---

### Task 1: Remove eager module preloading from DashboardShell

**File:** `src/components/layout/DashboardShell.tsx`

- [ ] **Step 1: Delete `MODULES_TO_PRELOAD` and its `useEffect`**

Remove lines 3 (`useEffect` import is still needed for... actually it's not needed anymore), 10-15 (MODULES_TO_PRELOAD), and 22-34 (useEffect block).

```tsx
// After change:
"use client";

import { Suspense, type ReactNode } from "react";

import { BottomNav } from "./BottomNav";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { PageSkeleton } from "@/shared/components/PageSkeleton";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="h-screen overflow-hidden bg-white text-gray-950">
      <div className="flex h-full w-full">
        <Sidebar />

        <div className="relative flex min-w-0 flex-1 flex-col bg-white">
          <Navbar />
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-24 pt-24 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
            <Suspense fallback={<PageSkeleton />}>
              <div className="animate-fade-in">{children}</div>
            </Suspense>
          </main>
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

export default DashboardShell;
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/DashboardShell.tsx
git commit -m "perf: remove eager module preloading from DashboardShell"
```

---

### Task 2: Lazy icon creation in Sidebar

**File:** `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Replace `navIcons` Record with factory functions**

```tsx
// Replace lines 29-36:
const navIcons: Record<DashboardNavIcon, () => React.ReactNode> = {
  accounting: () => <AccountingIcon />,
  contacts: () => <ContactsIcon />,
  dashboard: () => <DashboardIcon />,
  logs: () => <LogsIcon />,
  reservations: () => <ReservationsIcon />,
  users: () => <UsersIcon />,
};
```

- [ ] **Step 2: Update usage in JSX**

```tsx
// Line 96: Change icon={navIcons[item.icon]} to icon={navIcons[item.icon]()}
<SidebarNavLink
  href={href}
  icon={navIcons[item.icon]()}
  isActive={isActive}
  key={item.href || "dashboard"}
  label={t(item.labelKey)}
/>
```

- [ ] **Step 3: Build check**

Run: `pnpm build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "perf: lazy icon creation in Sidebar"
```

---

### Task 3: Lazy icon creation + remove prefetch in BottomNav

**File:** `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Replace `navIcons` Record with factory functions**

```tsx
// Replace lines 24-31:
const navIcons: Record<DashboardNavIcon, () => React.ReactNode> = {
  accounting: () => <AccountingIcon />,
  contacts: () => <ContactsIcon />,
  dashboard: () => <DashboardIcon />,
  logs: () => <LogsIcon />,
  reservations: () => <ReservationsIcon />,
  users: () => <UsersIcon />,
};
```

- [ ] **Step 2: Update icon usage and remove `prefetch={true}`**

Line 63: Change `prefetch={true}` to remove the prop entirely.
Line 69: Change `{navIcons[item.icon]}` to `{navIcons[item.icon]()}`

```tsx
// Lines 60-76 after change:
<Link
  key={item.href || "dashboard"}
  href={href}
  className={`flex min-w-0 flex-col items-center justify-center rounded-lg px-1 py-1.5 transition-all duration-200 ${
    active ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
  }`}
>
  <span className={active ? "text-blue-600" : "text-gray-400"}>
    {navIcons[item.icon]()}
  </span>
  <span
    className={`mt-0.5 max-w-full truncate text-[11px] font-medium ${active ? "text-blue-600" : "text-gray-400"}`}
  >
    {t(item.labelKey)}
  </span>
</Link>
```

- [ ] **Step 3: Build check**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/BottomNav.tsx
git commit -m "perf: lazy icon creation and remove prefetch from BottomNav"
```

---

### Task 4: Add bundle analyzer configuration

**File:** `next.config.ts`

- [ ] **Step 1: Wire bundle analyzer in next.config.ts**

```ts
import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  // ... existing config unchanged (distDir, images, headers)
};

const config = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);

export default config;
```

- [ ] **Step 2: Install `@next/bundle-analyzer` if not present**

Check `package.json` — it's already in devDependencies (`"@next/bundle-analyzer": "^16.2.6"`). No install needed.

- [ ] **Step 3: Verify analyze script**

Run: `npm pkg get scripts`
Expected: Should see the new analyze script. Appending it:

```bash
npm pkg set scripts.analyze="ANALYZE=true next build"
```

- [ ] **Step 4: Commit**

```bash
git add next.config.ts package.json
git commit -m "perf: add bundle analyzer config and analyze script"
```

---

### Task 5: Memoize authSlice selectors with createSelector

**File:** `src/store/authSlice.ts`

- [ ] **Step 1: Import `createSelector` and rewrite all selectors**

```tsx
import { createAsyncThunk, createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit'
// ... rest of imports unchanged

// Replace lines 159-165:
export const selectAuthState = createSelector(
  (state: RootState) => state.auth,
  (auth) => auth,
)
export const selectAuthUser = createSelector(
  selectAuthState,
  (auth) => auth.user,
)
export const selectAuthRole = createSelector(
  selectAuthState,
  (auth) => auth.role,
)
export const selectAuthLoading = createSelector(
  selectAuthState,
  (auth) => auth.loading,
)
export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (auth) => auth.isAuthenticated,
)
export const selectAuthError = createSelector(
  selectAuthState,
  (auth) => auth.error,
)
export const selectBlockedUntil = createSelector(
  selectAuthState,
  (auth) => auth.blockedUntil,
)
```

- [ ] **Step 2: Build check**

Run: `pnpm build`

- [ ] **Step 3: Commit**

```bash
git add src/store/authSlice.ts
git commit -m "perf: memoize authSlice selectors with createSelector"
```

---

### Task 6: Memoize uiSlice and dashboardSlice selectors

**File:** `src/store/slices/uiSlice.ts`, `src/modules/dashboard/store/dashboardSlice.ts`

- [ ] **Step 1: Add memoized selectors to uiSlice**

```tsx
import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit'
// ... rest of imports unchanged, add at bottom after export default:

export const selectUIState = createSelector(
  (state: RootState) => state.ui,
  (ui) => ui,
)
export const selectSidebarOpen = createSelector(
  selectUIState,
  (ui) => ui.sidebarOpen,
)
export const selectLocale = createSelector(
  selectUIState,
  (ui) => ui.locale,
)
export const selectGlobalLoading = createSelector(
  selectUIState,
  (ui) => ui.isGlobalLoading,
)
export const selectNotification = createSelector(
  selectUIState,
  (ui) => ui.notification,
)
```

Need to add the `RootState` import:
```tsx
import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/store'
```

- [ ] **Step 2: Check dashboardSlice for raw selectors**

Read `src/modules/dashboard/store/dashboardSlice.ts` and apply same `createSelector` pattern to all exported selectors.

```bash
# Check the file first:
cat src/modules/dashboard/store/dashboardSlice.ts | grep "export const select"
```

Apply the same `createSelector` wrapping for every raw selector found.

- [ ] **Step 3: Build check**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/store/slices/uiSlice.ts src/modules/dashboard/store/dashboardSlice.ts
git commit -m "perf: memoize uiSlice and dashboardSlice selectors"
```

---

### Task 7: Memoize usersSlice selectors

**File:** `src/modules/users/store/usersSlice.ts`

- [ ] **Step 1: Replace raw selectors with createSelector**

```tsx
import { createAsyncThunk, createSlice, createSelector, isFulfilled, isPending, isRejected } from '@reduxjs/toolkit'
// ... rest unchanged

// Replace lines 105-112:
export const selectUsersState = createSelector(
  (state: RootState) => state.users,
  (users) => users,
)
export const selectUsers = createSelector(
  selectUsersState,
  (users) => users.users,
)
export const selectUsersLoading = createSelector(
  selectUsersState,
  (users) => users.loading,
)
export const selectUsersError = createSelector(
  selectUsersState,
  (users) => users.error,
)
export const selectUsersHasMore = createSelector(
  selectUsersState,
  (users) => users.hasMore,
)
export const selectUsersLastFetchedAt = createSelector(
  selectUsersState,
  (users) => users.lastFetchedAt,
)
export const selectUsersNextCursor = createSelector(
  selectUsersState,
  (users) => users.nextCursor,
)
export const selectUsersTotal = createSelector(
  selectUsersState,
  (users) => users.total,
)
```

- [ ] **Step 2: Build check**

Run: `pnpm build`

- [ ] **Step 3: Commit**

```bash
git add src/modules/users/store/usersSlice.ts
git commit -m "perf: memoize usersSlice selectors"
```

---

### Task 8: Add React.memo to UsersPage

**File:** `src/modules/users/components/UsersPage.tsx`

- [ ] **Step 1: Wrap export with memo**

```tsx
import { memo, useCallback, useMemo, useState } from 'react'

// Change line 27:
export const UsersPage = memo(function UsersPage({ permissions }: { permissions: UsersPagePermissions }) {
```

- [ ] **Step 2: Build check**

Run: `pnpm build`

- [ ] **Step 3: Commit**

```bash
git add src/modules/users/components/UsersPage.tsx
git commit -m "perf: add React.memo to UsersPage"
```

---

### Task 9: Add React.memo to Table component

**File:** `src/shared/components/Table.tsx`

- [ ] **Step 1: Add memo wrapper**

```tsx
import { memo } from "react";
// ... rest of imports

export const Table = memo(function Table<T extends Record<string, unknown>>({
  // ... props unchanged
}: TableProps<T>) {
  // ... body unchanged
}) as <T extends Record<string, unknown>>(
  props: TableProps<T>,
) => React.ReactElement;
```

The generic type makes `memo` tricky. Use the explicit cast pattern:
```tsx
import { memo, type ReactElement } from "react";
// ...

function TableInner<T extends Record<string, unknown>>({
  data,
  columns,
  // ... all other props
}: TableProps<T>) {
  // ... body unchanged
}

export const Table = memo(TableInner as typeof TableInner) as typeof TableInner;
```

- [ ] **Step 2: Build check**

Run: `pnpm build`

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/Table.tsx
git commit -m "perf: add React.memo to Table component"
```

---

### Task 10: Hoist locale-independent labels in ContactsPage

**File:** `src/modules/contacts/components/ContactsPage.tsx`

- [ ] **Step 1: Extract label keys that don't change per locale**

The `labels` object in `useMemo` depends on `t`, which changes reference when locale changes. Split static keys from dynamic `t()` calls. Actually, since `t` itself already returns the localized string, the correct fix is to stabilize the `t` reference.

Looking at the i18n provider (`src/i18n/provider.tsx` line 49), `t` is created with `useCallback([locale])` — so it changes only when locale changes. The `useMemo([t])` correctly recomputes labels only when locale changes. The real issue is that `labels` is a new object reference each time.

Fix: keep `useMemo` but memoize the return value identity. Since `useMemo` already does this (it returns the same object if deps haven't changed), and `t` only changes on locale change, this is actually fine. The spec says to "hoist locale-independent label constants" — the static key names (like `title`, `subtitle`) don't change, but their *values* depend on locale.

Actually, looking more carefully — the `useMemo` already handles this correctly. The `labels` object is only rebuilt when `t` changes (locale switch). The real optimization for `ContactsPage` is that it's already wrapped in `memo`. Let me skip this task since the issue is less impactful than initially assessed and focus on higher-value items.

- [ ] **Step 1: Skip — `ContactsPage` already uses `memo` and `useMemo([t])` correctly**

Mark as not applicable and move to next task.

---

### Task 11: Singleton Supabase browser client

**File:** `src/services/supabase/client.ts`

- [ ] **Step 1: Replace factory with singleton pattern**

```tsx
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

let client: SupabaseClient<Database> | null = null;

export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  if (client) return client;

  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicEnv();
  client = createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);

  return client;
}
```

- [ ] **Step 2: Build check**

Run: `pnpm build`

- [ ] **Step 3: Commit**

```bash
git add src/services/supabase/client.ts
git commit -m "perf: singleton Supabase browser client"
```

---

### Task 12: Parallelize auth login flow

**File:** `src/services/auth/authService.ts`

- [ ] **Step 1: Restructure login to parallelize role fetch with session creation**

```tsx
export async function login(email: LoginCredentials['email'], password: LoginCredentials['password']): Promise<AuthSession> {
  try {
    const supabase = createBrowserSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) throw error
    if (!data.user) throw new AuthServiceError('auth/invalid_credentials')

    const authUser = toAuthenticatedUser(data.user)

    // Parallelize: fetch role profile and create session concurrently
    const [profile] = await Promise.all([
      fetchUserAccessProfile(authUser.id),
      createSession(),
    ])

    return {
      user: { ...authUser, displayName: profile.displayName ?? authUser.displayName },
      role: profile.role,
    }
  } catch (error) {
    throw toAuthServiceError(error, 'auth/login_failed')
  }
}
```

- [ ] **Step 2: Build check**

Run: `pnpm build`

- [ ] **Step 3: Commit**

```bash
git add src/services/auth/authService.ts
git commit -m "perf: parallelize auth login role fetch with session creation"
```

---

### Task 13: Request deduplication in CRUD client

**File:** `src/shared/crud/index.ts`

- [ ] **Step 1: Add in-flight request map**

```tsx
// Add after imports:
const inFlightRequests = new Map<string, Promise<unknown>>()

function inFlightKey(url: string, init?: RequestInit): string {
  return `${init?.method ?? 'GET'}:${url}`
}
```

- [ ] **Step 2: Add dedup logic in `requestJson` for GET requests**

```tsx
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  defaultError = 'crud/request_failed',
  toastOptions: CrudToastOptions = false,
): Promise<T> {
  const method = init.method ?? 'GET'

  // Deduplicate identical GET requests that are still in-flight
  if (method === 'GET') {
    const key = inFlightKey(url, init)
    const existing = inFlightRequests.get(key) as Promise<T> | undefined
    if (existing) return existing

    const promise = actualFetch<T>(url, init, defaultError, toastOptions)
    inFlightRequests.set(key, promise)
    promise.finally(() => { inFlightRequests.delete(key) })
    return promise
  }

  return actualFetch<T>(url, init, defaultError, toastOptions)
}

async function actualFetch<T>(
  url: string,
  init: RequestInit,
  defaultError: string,
  toastOptions: CrudToastOptions,
): Promise<T> {
  // Move the existing fetch logic here (lines 97-136 unchanged)
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
  } catch (error) {
    if (toastOptions !== false) {
      toast.error(toastOptions.errorMessage ?? 'Network error', {
        description: 'Check your connection and try again.',
      })
    }
    throw error
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = data?.error ?? defaultError
    if (toastOptions !== false) {
      toast.error(toastOptions.errorMessage ?? 'Operation failed', { description: message })
    }
    throw new Error(message)
  }

  const successMessage = hasApiResponseMessage(data)
    ? data.message
    : toastOptions === false
      ? undefined
      : toastOptions.successMessage

  if (toastOptions !== false && successMessage) {
    toast.success(successMessage)
  }

  return isApiResponseEnvelope<T>(data) ? data.data : data as T
}
```

- [ ] **Step 3: Build check**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/shared/crud/index.ts
git commit -m "perf: deduplicate in-flight GET requests in CRUD client"
```

---

### Task 14: Add React.cache() for server-side dedup

**File:** `src/services/supabase/server.ts`

- [ ] **Step 1: Wrap in React.cache() and fix empty catch**

```tsx
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { cookies } from "next/headers";

import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

export const createServerSupabaseClient = cache(async function createServerSupabaseClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicEnv();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Server Components cannot write cookies — expected during SSR.
            // Cookie refresh is handled by the auth proxy middleware.
            console.warn(`[supabase/server] failed to set cookie "${name}" (expected in RSC)`);
          }
        }
      },
    },
  });
});
```

- [ ] **Step 2: Build check**

Run: `pnpm build`

- [ ] **Step 3: Commit**

```bash
git add src/services/supabase/server.ts
git commit -m "perf: wrap createServerSupabaseClient in React.cache(), fix catch"
```

---

### Task 15: Add useDebounce hook

**File:** Create `src/hooks/useDebounce.ts`

- [ ] **Step 1: Create the hook**

```tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface UseDebounceOptions {
  leading?: boolean
  trailing?: boolean
}

export function useDebounce<T>(value: T, delay: number, options: UseDebounceOptions = {}): T {
  const { leading = false, trailing = true } = options
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const leadingRef = useRef(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (leading && leadingRef.current) {
      setDebouncedValue(value)
      leadingRef.current = false
      return
    }

    if (trailing) {
      clear()
      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(value)
        leadingRef.current = true
      }, delay)
    }

    return clear
  }, [value, delay, leading, trailing, clear])

  return debouncedValue
}
```

- [ ] **Step 2: Create barrel export**

Read `src/hooks/index.ts` and add re-export if it exists.

```bash
# Check if it has content
cat src/hooks/index.ts
```

```ts
// src/hooks/index.ts
export { useDebounce } from './useDebounce'
```

- [ ] **Step 3: Build check**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDebounce.ts src/hooks/index.ts
git commit -m "feat: add useDebounce hook for throttled inputs"
```

---

### Task 16: Add useMediaQuery hook

**File:** Create `src/hooks/useMediaQuery.ts`

- [ ] **Step 1: Create the hook**

```tsx
'use client'

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
```

- [ ] **Step 2: Add to barrel export**

```ts
// src/hooks/index.ts — append:
export { useMediaQuery } from './useMediaQuery'
```

- [ ] **Step 3: Build check**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useMediaQuery.ts src/hooks/index.ts
git commit -m "feat: add useMediaQuery hook for responsive rendering"
```

---

### Task 17: Conditional table view rendering

**Files:** `src/shared/components/Table.tsx`, `src/shared/components/TableDesktopView.tsx`, `src/shared/components/TableMobileView.tsx`

- [ ] **Step 1: Update Table to render only one view based on media query**

```tsx
"use client";

import { memo, type ReactElement } from "react";
import type { TableColumn } from "../table/types";
import { TablePagination } from "./TablePagination";
import { TableMobileView } from "./TableMobileView";
import { TableDesktopView } from "./TableDesktopView";
import { useTableState } from "./useTableState";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface TableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: TableColumn<T>[];
  sortable?: boolean;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  paginate?: boolean;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  selectable?: boolean;
  selectedRowIds?: readonly string[];
  onSelectedRowIdsChange?: (ids: string[]) => void;
  getRowId?: (row: T, index: number) => string;
  selectionLabel?: string;
}

function TableInner<T extends Record<string, unknown>>({
  data,
  columns,
  sortable = true,
  onRowClick,
  loading,
  emptyMessage = "No data available",
  paginate = true,
  pageSize = 10,
  pageSizeOptions,
  selectable = false,
  selectedRowIds = [],
  onSelectedRowIdsChange,
  getRowId,
  selectionLabel = "Select row",
}: TableProps<T>) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const table = useTableState({
    columns,
    data,
    getRowId,
    onSelectedRowIdsChange,
    pageSize,
    paginate,
    selectable,
    selectedRowIds,
    sortable,
  });

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {isDesktop ? (
        <TableDesktopView
          allPageRowsSelected={table.allPageRowsSelected}
          columns={columns}
          data={table.paginatedData}
          getRowId={table.getResolvedRowId}
          isSelectable={table.isSelectable}
          onPageSelectionChange={table.handlePageSelectionChange}
          onRowClick={onRowClick}
          onRowSelectionChange={table.handleRowSelectionChange}
          onSort={table.handleSort}
          selectedRowIdSet={table.selectedRowIdSet}
          selectionLabel={selectionLabel}
          sortable={sortable}
          somePageRowsSelected={table.somePageRowsSelected}
          sort={table.sort}
        />
      ) : (
        <TableMobileView
          data={table.paginatedData}
          columns={columns}
          onRowClick={onRowClick}
          selectable={table.isSelectable}
          isRowSelected={(row, index) => table.selectedRowIdSet.has(table.getResolvedRowId(row, index))}
          onToggleRow={(row, index, checked) =>
            table.handleRowSelectionChange(table.getResolvedRowId(row, index), checked)
          }
          selectionLabel={selectionLabel}
        />
      )}
      {paginate && table.totalPages > 1 ? (
        <TablePagination
          currentPage={table.currentPage}
          totalPages={table.totalPages}
          pageSize={table.activePageSize}
          pageSizeOptions={pageSizeOptions}
          totalItems={table.sortedData.length}
          onPageChange={table.setPage}
          onPageSizeChange={table.handlePageSizeChange}
        />
      ) : null}
    </div>
  );
}

export const Table = memo(TableInner as typeof TableInner) as typeof TableInner;
```

- [ ] **Step 2: Remove `hidden`/`md:block` class wrappers from view components**

In `TableDesktopView.tsx`, remove the outer `hidden md:block` wrapper div (line 49) — replace with a Fragment:
```tsx
return (
  <>
    <table className="min-w-full">
```

In `TableMobileView.tsx`, remove `md:hidden` from the outer `div` (line 34):
```tsx
<div className="grid gap-2 bg-white">
```

- [ ] **Step 3: Build check**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/Table.tsx src/shared/components/TableDesktopView.tsx src/shared/components/TableMobileView.tsx
git commit -m "perf: conditional table view rendering via useMediaQuery"
```

---

### Task 18: Optimize AOSInit with MutationObserver

**File:** `src/components/AOSInit.tsx`

- [ ] **Step 1: Replace querySelectorAll with MutationObserver + cleanup willChange**

```tsx
'use client'

import { useEffect, useRef } from 'react'

const animationCSS: Record<string, string> = {
  'fade-up': 'translateY(20px)',
  'fade-down': 'translateY(-20px)',
  'fade-in': 'scale(0.9)',
}

function setupAnimations(container: HTMLElement) {
  const elements = container.querySelectorAll<HTMLElement>('[data-aos]')
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          el.style.opacity = '1'
          el.style.transform = 'translateY(0) scale(1)'
          el.style.willChange = 'auto'
          observer.unobserve(el)
        }
      })
    },
    { threshold: 0.1, rootMargin: '60px 0px' },
  )

  elements.forEach((el) => {
    const anim = el.getAttribute('data-aos') ?? 'fade-up'
    const delay = parseInt(el.getAttribute('data-aos-delay') ?? '0', 10)
    const duration = 400

    el.style.opacity = '0'
    el.style.transform = animationCSS[anim] ?? animationCSS['fade-up']
    el.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`
    el.style.transitionDelay = `${delay}ms`
    el.style.willChange = 'opacity, transform'
    observer.observe(el)
  })

  return observer
}

export function AOSInit() {
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const docEl = document.documentElement
    observerRef.current = setupAnimations(docEl)

    const mutationObserver = new MutationObserver((mutations) => {
      let hasNewAos = false
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement && (node.matches('[data-aos]') || node.querySelector('[data-aos]'))) {
            hasNewAos = true
            break
          }
        }
        if (hasNewAos) break
      }
      if (hasNewAos && observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = setupAnimations(docEl)
      }
    })

    mutationObserver.observe(docEl, { childList: true, subtree: true })

    return () => {
      observerRef.current?.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  return null
}

export default AOSInit
```

- [ ] **Step 2: Build check**

Run: `pnpm build`

- [ ] **Step 3: Commit**

```bash
git add src/components/AOSInit.tsx
git commit -m "perf: optimize AOSInit with MutationObserver, cleanup willChange"
```

---

### Task 19: Use `after()` for non-blocking audit logging

**File:** `src/services/logs/logService.ts`

- [ ] **Step 1: Import `after` and wrap `createLog`**

```tsx
import 'server-only'

import { after } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase/server'
// ... rest of imports unchanged

export async function createLog(logData: CreateLogDocumentInput): Promise<void> {
  // Don't block the response — fire the log write after response is sent
  after(async () => {
    try {
      const supabase = await createServerSupabaseClient()
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          action: logData.action,
          actor: jsonObject(sanitizeLogData(logData.actor)),
          created_at: createdAtToIso(logData.createdAt),
          description: logData.description,
          metadata: logData.metadata ? jsonObject(sanitizeLogData(logData.metadata)) : null,
          module: logData.module,
          target: logData.target ? jsonObject(sanitizeLogData(logData.target)) : null,
        })

      if (error) {
        console.error('[logs/createLog] failed:', error.message)
      }
    } catch (error) {
      console.error('[logs/createLog] unexpected error:', error)
    }
  })
}
```

- [ ] **Step 2: Update all callers that await createLog**

Search for `await createLog(` or `await logAction(` patterns. If they use the result, change to `void`. If they await it for ordering, restructure.

```bash
# Find callers
rg "await createLog" src/
rg "await logAction" src/
```

- [ ] **Step 3: Build check**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/services/logs/logService.ts
git commit -m "perf: make audit log writes non-blocking with after()"
```

---

### Task 20: Add content-visibility to list pages

**Files:** CSS can be applied directly in page components or via a utility class.

- [ ] **Step 1: Add a utility CSS class**

In `src/app/globals.css`, add:
```css
.content-visibility-auto {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px;
}
```

- [ ] **Step 2: Apply to list containers in Users, Contacts, Logs pages**

For each list page, add `className="content-visibility-auto"` to the container div wrapping the table or grid.

In `UsersPage.tsx`:
```tsx
// The view switching already conditionally renders. Add to the outer wrapper:
<div className="content-visibility-auto">
  {view.view === 'row' ? (
    <UsersTable ... />
  ) : (
    <UsersGrid ... />
  )}
</div>
```

In `ContactsPage.tsx` (same pattern around the view switch).

In `LogsPage.tsx` (read the file to find the right container).

- [ ] **Step 3: Build check**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/modules/users/components/UsersPage.tsx src/modules/contacts/components/ContactsPage.tsx
git commit -m "perf: add content-visibility to list page containers"
```

---

## Spec Coverage Check

| Spec Section | Task(s) | Status |
|---|---|---|
| 1. Bundle Size & Code Splitting | 1 (remove preload), 2+3 (lazy icons), 4 (bundle analyzer) | Covered |
| 2. Redux Selector Memoization | 5 (authSlice), 6 (ui/dashboard), 7 (usersSlice), 8 (UsersPage memo), 9 (Table memo), 10 (Contact labels — skipped, already optimal) | Covered |
| 3. Data Fetching & Caching | 11 (singleton client), 12 (parallel login), 13 (CRUD dedup), 14 (React.cache server), 15 (useDebounce) | Covered |
| 4. Rendering & DOM | 16 (useMediaQuery), 17 (conditional table), 18 (AOSInit), 20 (content-visibility) | Covered |
| 5. Server-Side Perf | 14 (React.cache + fix catch), 19 (after() for logs) | Covered |
