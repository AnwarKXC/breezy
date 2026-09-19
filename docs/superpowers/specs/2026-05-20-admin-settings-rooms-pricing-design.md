# Admin Settings: Room Types, Rooms & Pricing — Design Spec

## Overview

Add a **Settings** tab to the dashboard navigation containing three admin tools for room management: Room Types (managed CRUD), Rooms (admin CRUD UI), and Pricing (per-type base price editor). Accountants and admins have read/write access.

## Data Model

### New Table: `room_types`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, `gen_random_uuid()` | |
| `name` | `text` UNIQUE NOT NULL | Display name e.g. "Standard", "Penthouse" |
| `slug` | `text` UNIQUE NOT NULL | URL-safe identifier, used as FK target |
| `description` | `text` | Optional |
| `base_price` | `numeric(10,2)` NOT NULL | Default per-night price |
| `default_capacity` | `integer` NOT NULL | Default occupancy |
| `amenities` | `jsonb` DEFAULT `'[]'` | Preset amenity list |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Trigger**: `room_types_set_updated_at` on UPDATE (standard pattern).

**RLS**: Admin + Accountant can SELECT/INSERT/UPDATE/DELETE. Other roles get no access.

### Migration: `rooms` table

Add column: `room_type_id uuid REFERENCES room_types(id) ON DELETE RESTRICT`. Drop the `type room_type` enum column. The enum `room_type` itself stays (no breaking removal needed — just no longer referenced).

### New Table: `room_type_pricing`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `room_type_id` | `uuid` FK → `room_types(id)` ON DELETE CASCADE | |
| `price` | `numeric(10,2)` NOT NULL | Per-night base rate |
| `currency` | `text` DEFAULT `'USD'` | |
| `effective_from` | `timestamptz` | Optional — future dated |
| `effective_until` | `timestamptz` | Optional — expiry |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Constraint**: `(room_type_id, currency, effective_from)` unique with partial index on `effective_from IS NOT NULL`.

**RLS**: Admin + Accountant full access. Other roles: SELECT only.

## Navigation & RBAC

### New Permission Module

`PERMISSION_MODULES.SETTINGS = "settings"` → allowed roles: `["admin", "accountant"]`

### New Navigation Entry

```ts
{ href: "/settings", icon: "settings", labelKey: "nav.settings", module: "settings" }
```

Automatically appears in Sidebar (desktop) and BottomNav (mobile) via existing `canAccessModule` filtering.

### New Action Permissions

```ts
ACTIONS.SETTINGS_READ = "settings:read"
ACTIONS.SETTINGS_WRITE = "settings:write"
```

Assigned to: `admin`, `accountant`.
Service guards: `requireSettingsRead()`, `requireSettingsWrite()`.

### Edge Middleware

`/:locale(en|ar)/settings*` is caught by `isPermissionModule("settings")` — unauthorized redirects to `/unauthorized`.

### Title Key

`DASHBOARD_TITLE_KEYS` gets `["/settings", "settings.title"]`.

## Module Structure

Three new modules plus extending the existing rooms skeleton:

```
src/modules/
  room-types/
    types.ts
    index.ts
    constants.ts
    services/
      index.ts
      roomTypeService.ts        (server-only)
      roomTypeApiClient.ts       (client, createCrudApiClient)
    hooks/
      index.ts
      useRoomTypes.ts
    components/
      RoomTypesTab.tsx           (list + CRUD inline in Settings tab)
    store/
      roomTypesSlice.ts

  rooms/                         (extend skeleton)
    types.ts                     (add room_type_id, update Room)
    index.ts                     (re-export new exports)
    services/
      index.ts
      roomService.ts             (migrate from src/services/roomService.ts)
      roomsApiClient.ts          (new — client CRUD client)
    hooks/
      index.ts
      useRooms.ts                (extend with API client integration)
    components/
      RoomsTab.tsx               (admin list + create/edit form)
    store/
      roomsSlice.ts              (new)

  pricing/
    types.ts
    index.ts
    services/
      index.ts
      pricingService.ts          (server-only)
      pricingApiClient.ts        (client CRUD client)
    hooks/
      index.ts
      usePricing.ts
    components/
      PricingTab.tsx             (per-type price editor grid)

  settings/                      (hub — the tab container and entry point)
    components/
      SettingsPage.tsx           (tab container with navigation)
```

## API Routes

```
api/room-types/route.ts               GET (list, cursor), POST (create)
api/room-types/[id]/route.ts          GET, PATCH, DELETE

api/rooms/route.ts                    GET (list, cursor), POST (create)
api/rooms/[id]/route.ts               GET, PATCH, DELETE

api/pricing/route.ts                  GET (list), POST (create)
api/pricing/[id]/route.ts             PATCH, DELETE
```

Each route handler follows the established pattern: `validateCsrf` (state-changing), `authorizeRequest` with appropriate action permission, delegate to server service, return `NextResponse.json`.

## SettingsPage — Tab Container

Single-page tabs container (state-based, no sub-routes):

```tsx
type SettingsTab = "room-types" | "rooms" | "pricing"

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("room-types")
  // renders tab bar + active component
}
```

Each tab is a self-contained component imported from its respective module. No URL change on tab switch.

## Migration Plan

One new Supabase migration file:

1. `20260520000000_add_room_types_and_pricing.sql` — create `room_types` and `room_type_pricing` tables, add `room_type_id` to `rooms`, drop `rooms.type` column, RLS policies, indexes, triggers.

Then regenerate `database.types.ts` via `supabase_generate_typescript_types`.

## i18n

New translation keys in existing locale files:

```
nav.settings
settings.title
roomTypes.title
roomTypes.name
roomTypes.description
roomTypes.basePrice
roomTypes.defaultCapacity
roomTypes.amenities
rooms.title
pricing.title
pricing.perNight
pricing.currency
pricing.effectiveFrom
pricing.effectiveUntil
```

## Out of Scope

- Dynamic seasonal/occupancy pricing rules (complex rules engine deferred)
- Room analytics/metrics within Settings (separate Dashboard module concern)
- Bulk room import/export (deferred)
