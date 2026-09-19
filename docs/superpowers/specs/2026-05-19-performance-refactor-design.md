# Performance Refactor — Hotel Management System

**Date:** 2026-05-19
**Approach:** B — Full Performance Pass + Architectural Cleanup

## 1. Bundle Size & Code Splitting

### Problems
- `MODULES_TO_PRELOAD` in `DashboardShell.tsx` eagerly imports 4 feature modules on mount, defeating Next.js route-based code splitting.
- `navIcons` objects in `Sidebar.tsx` and `BottomNav.tsx` instantiate all icon JSX at module evaluation time, even for components that are never visible (e.g., BottomNav on desktop).
- No bundle analysis pipeline exists.

### Changes
1. **Remove `MODULES_TO_PRELOAD`** from `src/components/layout/DashboardShell.tsx`. The modules (Dashboard, Users, Contacts, Logs) are already lazy-loaded by the App Router on route entry.
2. **Replace `Record<DashboardNavIcon, React.ReactNode>` with factory functions** `() => <AccountingIcon />` in both `Sidebar.tsx` and `BottomNav.tsx`. Icons instantiate only when the nav list renders.
3. **Audit barrel imports** — check `src/modules/users/`, `src/modules/contacts/`, `src/modules/logs/`, and `src/modules/dashboard/` index.ts barrel files. Replace `import { ... } from '@/modules/users'` with `import { ... } from '@/modules/users/components/UsersPage'` style direct imports in page components. Check `src/shared/index.ts` for the same pattern — page-level components should import directly from the specific file, not the barrel.
4. **Add bundle analyzer** — wire `@next/bundle-analyzer` to `ANALYZE=true` env var in `next.config.ts`.

### Files touched
- `src/components/layout/DashboardShell.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/BottomNav.tsx`
- `next.config.ts`

## 2. Redux Selector Memoization & Re-render Prevention

### Problems
- `selectAuthState` returns a new `{ user, role, loading, ... }` object each call — every `useAppSelector(selectAuthState)` subscriber re-renders on any Redux dispatch.
- `useUsers.ts` subscribes to 7 individual raw selectors — each is a plain arrow returning a state slice, no memoization.
- `UsersPage` is missing `React.memo` (unlike `ContactsPage`).
- `Table` component has no `memo` — re-renders on prop changes cascade to both child views.
- `ContactsPage` rebuilds a 30-key label object in `useMemo` that depends on the `t` function reference.

### Changes
1. **`createSelector` for all slice selectors** — in `authSlice.ts`, `uiSlice.ts`, `usersSlice.ts`, `dashboardSlice.ts`. Create memoized selectors:
   - `selectAuthState` → memoized
   - `selectAuthUser`, `selectAuthRole`, `selectAuthLoading`, `selectAuthError`, `selectIsAuthenticated`, `selectBlockedUntil`
   - `selectSidebarCollapsed`, `selectNotifications` (uiSlice)
   - `selectUsers`, `selectUsersLoading`, `selectUsersError`, `selectUsersTotal`, etc.
2. **Add `React.memo` to `UsersPage`** — wrap the exported component.
3. **Add `React.memo` to `Table`** — prevent re-render when parent passes new object references.
4. **Hoist locale-independent label constants** — separate static keys from dynamic `t()` calls in `ContactsPage`.
5. **Derived state selectors** — replace inline `isAuthenticated` derivations with `selectIsAuthenticated` selector.

### Files touched
- `src/store/authSlice.ts`
- `src/store/slices/uiSlice.ts`
- `src/modules/users/store/usersSlice.ts`
- `src/modules/dashboard/store/dashboardSlice.ts`
- `src/modules/users/components/UsersPage.tsx`
- `src/shared/table/Table.tsx`
- `src/modules/contacts/components/ContactsPage.tsx`
- `src/store/hooks.ts` (add re-export of memoized selectors)

## 3. Data Fetching & Caching

### Problems
- `createBrowserSupabaseClient()` creates a new instance per API call — no reuse means repeated cookie reads/writes.
- CRUD client (`shared/crud/`) has no request deduplication — simultaneous identical GET calls trigger multiple requests.
- Auth login flow is serial: `signInWithPassword()` → `fetchUserAccessProfile()`, delaying login by the role query latency.
- Server-side data fetchers don't use `React.cache()` — duplicate calls within the same render pass hit the network.
- No `useDebounce` hook exists — search/filter inputs fire per-keystroke.

### Changes
1. **Singleton Supabase browser client** — cache instance in module-level variable:
   ```ts
   let client: SupabaseClient<Database> | null = null
   export function createBrowserSupabaseClient() {
     if (client) return client
     client = createBrowserClient<Database>(supabaseUrl, supabasePublishableKey)
     return client
   }
   ```
2. **Parallelize login** — after `signInWithPassword()`, dispatch `getCurrentSession()` and `fetchUserAccessProfile()` concurrently (role fetch needs the user ID from the auth response).
3. **In-flight request dedup** — in `shared/crud/index.ts`, maintain a `Map<string, Promise<T>>` of in-flight GET requests. Return existing promise for duplicate calls with the same URL+params.
4. **Wrap server fetchers in `React.cache()`** — `createServerSupabaseClient()`, `getCurrentServerSession()`.
5. **Add `useDebounce` hook** — `src/hooks/useDebounce.ts` with configurable delay and leading/trailing options.

### Files touched
- `src/services/supabase/client.ts`
- `src/services/auth/authService.ts`
- `src/services/auth/sessionService.ts`
- `src/services/auth/roleService.ts`
- `src/services/auth/serverSession.ts`
- `src/shared/crud/index.ts`
- `src/services/supabase/server.ts`
- `src/hooks/useDebounce.ts` (new file)

## 4. Rendering & DOM Optimization

### Problems
- `Table` renders both `TableMobileView` and `TableDesktopView` simultaneously — CSS hides one with `md:hidden` / `hidden md:table-header-group`, but both process data, render DOM nodes, and attach event handlers.
- `BottomNav` sets `prefetch={true}` on every `Link`, triggering data fetches for all dashboard routes on page load.
- `AOSInit` scans the entire DOM with `querySelectorAll('[data-aos]')` — re-scans all elements, doesn't observe new additions.
- `willChange` is never removed after animation completes, keeping GPU memory allocated.

### Changes
1. **Conditional table view** — add `useMediaQuery('(min-width: 768px)')` hook that renders only one view. Keep a `display: none` placeholder for the hidden view to maintain CSS grid layout stability during resize.
2. **Remove `prefetch={true}` from BottomNav** — rely on Next.js's `prefetch` on hover/visibility default.
3. **Optimize AOSInit** — use `MutationObserver` to watch only new `[data-aos]` elements. Remove `willChange` after transitionend.
4. **Add `content-visibility: auto`** — on list containers in Users, Contacts, Logs pages to skip off-screen row rendering.

### Files touched
- `src/shared/table/Table.tsx`
- `src/shared/table/TableDesktopView.tsx`
- `src/shared/table/TableMobileView.tsx`
- `src/components/layout/BottomNav.tsx`
- `src/components/AOSInit.tsx`
- `src/hooks/useMediaQuery.ts` (new file)
- `src/modules/users/components/UsersPage.tsx`
- `src/modules/contacts/components/ContactsPage.tsx`
- `src/modules/logs/components/LogsPage.tsx`

## 5. Server-Side Performance & Non-Blocking Operations

### Problems
- Server cookie write errors are silently swallowed in a bare `catch {}` in `createServerSupabaseClient()`.
- Audit log writes (`logAction()`) block the response — adds 50-150ms latency to every mutation.
- No per-request dedup for server data fetchers — `React.cache()` isn't used.
- Static configuration is read per-request instead of once at module level.

### Changes
1. **Fix cookie error handling** — replace empty `catch {}` with a logged warning and structured fallback. Use `console.warn` (will be removed before production via lint rule) or a structured logger.
2. **Use `after()` for audit logging** — wrap `logAction()` calls in Next.js's `after()` to make them non-blocking. This requires the `after` import from `next/server`.
3. **Server component data fetching audit** — audit these RSC pages and ensure they use `Promise.all()` for independent queries and `React.cache()` for dedup:
   - `src/app/[locale]/(dashboard)/page.tsx` — fetches dashboard metrics + user session + role
   - `src/modules/contacts/services/contactsService.ts` — `getContactsPage()` fetches contacts + analytics + count
   - `src/modules/users/services/usersService.ts` — `getUsersPage()` fetches users + analytics
   - `src/modules/logs/services/logsService.ts` — `getLogsPage()` fetches logs + actors
4. **Hoist static I/O** — move font config, locale metadata, and RBAC role definitions to module-level computation where applicable (already partially done — audit remaining files).

### Files touched
- `src/services/supabase/server.ts`
- `src/modules/logs/services/logService.ts` (audit log actions that need `after()`)
- `src/app/[locale]/(dashboard)/page.tsx` (dashboard data fetching)
- `src/modules/users/services/usersService.ts`
- `src/modules/contacts/services/contactsService.ts`

## Files Created
- `src/hooks/useDebounce.ts`
- `src/hooks/useMediaQuery.ts`

## Files Modified (summary)
- `next.config.ts` — bundle analyzer
- `src/store/authSlice.ts` — memoized selectors
- `src/store/slices/uiSlice.ts` — memoized selectors
- `src/store/hooks.ts` — re-export memoized selectors
- `src/services/supabase/client.ts` — singleton
- `src/services/supabase/server.ts` — `React.cache`, fixed catch
- `src/services/auth/authService.ts` — parallel login
- `src/shared/crud/index.ts` — request dedup
- `src/shared/table/Table.tsx` — memo, conditional view
- `src/components/layout/DashboardShell.tsx` — remove preload
- `src/components/layout/Sidebar.tsx` — lazy icons
- `src/components/layout/BottomNav.tsx` — lazy icons, no prefetch
- `src/components/AOSInit.tsx` — mutation observer, cleanup
- `src/modules/users/components/UsersPage.tsx` — React.memo
- `src/modules/contacts/components/ContactsPage.tsx` — hoist labels
- `src/modules/users/store/usersSlice.ts` — memoized selectors
- `src/modules/dashboard/store/dashboardSlice.ts` — memoized selectors
- `src/modules/logs/services/logService.ts` — `after()` for non-blocking
- `src/app/[locale]/(dashboard)/page.tsx` — parallel data fetching

## Out of Scope (Deferred)
- Full Web Vitals monitoring with `web-vitals` library
- LHCI CI/CD pipeline
- Image optimization audit (next/image format/size pass)
- Service worker caching strategy refinement
- CSS extraction and critical CSS inlining
- Font subsetting audit
