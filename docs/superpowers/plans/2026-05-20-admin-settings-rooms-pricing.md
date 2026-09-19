# Admin Settings: Room Types, Rooms & Pricing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings tab with Room Types CRUD, Rooms admin CRUD UI, and per-type Pricing management, accessible to admins and accountants.

**Architecture:** Single-page Settings tab with 3 state-switched sub-views. Each feature gets its own module (`room-types/`, `rooms/`, `pricing/`) following the contacts blueprint pattern. Settings module is a thin hub container. RBAC extends the existing permission system with a SETTINGS module.

**Tech Stack:** Next.js App Router, Supabase (Postgres), TypeScript, RTK slices, shared CRUD client, existing RBAC framework.

---

## File Map

### Files to Create
```
supabase/migrations/20260520000000_add_room_types_and_pricing.sql
src/config/actionPermissions.ts                              (modify)
src/config/permissions.ts                                     (modify)
src/config/navigation.ts                                      (modify)
src/i18n/locales/en/common.json                               (modify)
src/i18n/locales/ar/common.json                               (modify)

src/modules/room-types/index.ts
src/modules/room-types/types.ts
src/modules/room-types/constants.ts
src/modules/room-types/services/index.ts
src/modules/room-types/services/roomTypeService.ts
src/modules/room-types/services/roomTypeApiClient.ts
src/modules/room-types/hooks/index.ts
src/modules/room-types/hooks/useRoomTypes.ts
src/modules/room-types/store/roomTypesSlice.ts
src/modules/room-types/components/RoomTypesTab.tsx

src/modules/rooms/services/index.ts
src/modules/rooms/services/roomsApiClient.ts
src/modules/rooms/store/roomsSlice.ts
src/modules/rooms/components/RoomsTab.tsx

src/modules/pricing/index.ts
src/modules/pricing/types.ts
src/modules/pricing/services/index.ts
src/modules/pricing/services/pricingService.ts
src/modules/pricing/services/pricingApiClient.ts
src/modules/pricing/hooks/index.ts
src/modules/pricing/hooks/usePricing.ts
src/modules/pricing/store/pricingSlice.ts
src/modules/pricing/components/PricingTab.tsx

src/modules/settings/components/SettingsPage.tsx

src/app/api/room-types/route.ts
src/app/api/room-types/[id]/route.ts
src/app/api/rooms/route.ts
src/app/api/rooms/[id]/route.ts
src/app/api/pricing/route.ts
src/app/api/pricing/[id]/route.ts
```

### Files to Modify
```
src/services/roomService.ts                                   (refactor — move into rooms module)
src/modules/rooms/types.ts                                    (add roomTypeId, remove type)
src/modules/rooms/index.ts                                    (add new exports)
src/modules/rooms/hooks/useRooms.ts                           (integrate API client)
src/modules/rooms/hooks/index.ts                              (add new exports)
src/services/supabase/database.types.ts                       (regenerate after migration)
```

---

### Task 1: Supabase migration

**Files:**
- Create: `supabase/migrations/20260520000000_add_room_types_and_pricing.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Room Types (managed CRUD entity replacing hardcoded enum)
create table if not exists public.room_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  base_price numeric(10,2) not null,
  default_capacity integer not null,
  amenities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_types_name_unique unique (name),
  constraint room_types_slug_unique unique (slug),
  constraint room_types_base_price_nonnegative check (base_price >= 0),
  constraint room_types_default_capacity_positive check (default_capacity > 0)
);

-- Room Type Pricing (per-type base rates)
create table if not exists public.room_type_pricing (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  price numeric(10,2) not null,
  currency text not null default 'USD',
  effective_from timestamptz,
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_type_pricing_price_nonnegative check (price >= 0)
);

-- Unique constraint: one current price per type+currency (when no effective_from)
create unique index room_type_pricing_current_unique
  on public.room_type_pricing (room_type_id, currency)
  where effective_from is null;

-- Indexes
create index room_type_pricing_room_type_id_idx on public.room_type_pricing (room_type_id);
create index room_type_pricing_effective_from_idx on public.room_type_pricing (effective_from);

-- Add room_type_id FK to rooms, then drop the enum column
alter table public.rooms
  add column room_type_id uuid references public.room_types(id) on delete restrict;

-- Backfill: insert default room types based on existing enum values
insert into public.room_types (name, slug, description, base_price, default_capacity)
values
  ('Standard', 'standard', null, 100.00, 2),
  ('Deluxe', 'deluxe', null, 180.00, 2),
  ('Suite', 'suite', null, 350.00, 4),
  ('Family', 'family', null, 250.00, 4)
on conflict (slug) do nothing;

-- Backfill room_type_id based on existing type enum values
update public.rooms r
set room_type_id = rt.id
from public.room_types rt
where rt.slug = r.type::text
  and r.room_type_id is null;

-- Make room_type_id NOT NULL after backfill
alter table public.rooms
  alter column room_type_id set not null;

-- Drop the now-redundant type enum column
alter table public.rooms
  drop column type;

-- RLS: room_types
alter table public.room_types enable row level security;

create policy "Staff can read room_types"
  on public.room_types for select
  to authenticated
  using (true);

create policy "Admin and accountant can manage room_types"
  on public.room_types for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
  );

create policy "Admin and accountant can update room_types"
  on public.room_types for update
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
  );

create policy "Admin and accountant can delete room_types"
  on public.room_types for delete
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
  );

-- RLS: room_type_pricing
alter table public.room_type_pricing enable row level security;

create policy "Staff can read room_type_pricing"
  on public.room_type_pricing for select
  to authenticated
  using (true);

create policy "Admin and accountant can manage room_type_pricing"
  on public.room_type_pricing for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
  );

create policy "Admin and accountant can update room_type_pricing"
  on public.room_type_pricing for update
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
  );

create policy "Admin and accountant can delete room_type_pricing"
  on public.room_type_pricing for delete
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
  );

-- Updated_at triggers
create or replace function private.room_types_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger room_types_set_updated_at
  before update on public.room_types
  for each row execute function private.room_types_set_updated_at();

create or replace function private.room_type_pricing_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger room_type_pricing_set_updated_at
  before update on public.room_type_pricing
  for each row execute function private.room_type_pricing_set_updated_at();

-- Update rooms updated_at trigger to include room_type_id changes if not already covered
-- (rooms_set_updated_at already exists from the previous migration, no change needed)
```

- [ ] **Step 2: Apply the migration**

Run: `supabase_apply_migration` with name `20260520000000_add_room_types_and_pricing`

Expected: Migration applies successfully with no errors.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `supabase_generate_typescript_types`

Expected: `src/services/supabase/database.types.ts` updated with `room_types` and `room_type_pricing` tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260520000000_add_room_types_and_pricing.sql src/services/supabase/database.types.ts
git commit -m "feat: add room_types and room_type_pricing tables with RLS"
```

---

### Task 2: RBAC — Add SETTINGS module and action permissions

**Files:**
- Modify: `src/config/permissions.ts`
- Modify: `src/config/actionPermissions.ts`
- Modify: `src/config/navigation.ts`
- Modify: `src/modules/contacts/services/serviceSecurity.ts` (if following exact pattern for reference - skip, contacts-specific)

- [ ] **Step 1: Add SETTINGS to permission modules**

Read `src/config/permissions.ts`:

```ts
// Add to PERMISSION_MODULES:
export const PERMISSION_MODULES = {
  // ...existing keys
  SETTINGS: 'settings',
} as const;
```

Then add to `PERMISSIONS`:
```ts
[PERMISSION_MODULES.SETTINGS]: [ROLES.ADMIN, ROLES.ACCOUNTANT],
```

- [ ] **Step 2: Add SETTINGS action permissions**

Read `src/config/actionPermissions.ts`.

Add action constants:
```ts
export const ACTIONS = {
  // ...existing
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
} as const;
```

Add to `ActionPermission` type union:
```ts
export type ActionPermission = typeof ACTIONS[keyof typeof ACTIONS];
// Already auto-derived, no change needed if ACTIONS is const
```

Add to `ROLE_PERMISSIONS`:
```ts
[ROLES.ADMIN]: [
  // ...existing
  ACTIONS.SETTINGS_READ,
  ACTIONS.SETTINGS_WRITE,
],
[ROLES.ACCOUNTANT]: [
  // ...existing
  ACTIONS.SETTINGS_READ,
  ACTIONS.SETTINGS_WRITE,
],
```

- [ ] **Step 3: Add settings to DASHBOARD_NAV_ITEMS**

Read `src/config/navigation.ts`.

Add entry to `DASHBOARD_NAV_ITEMS`:
```ts
{ href: '/settings', icon: 'settings', labelKey: 'nav.settings', module: PERMISSION_MODULES.SETTINGS },
```

Add to `DASHBOARD_TITLE_KEYS`:
```ts
['/settings', 'settings.title'],
```

- [ ] **Step 4: Commit**

```bash
git add src/config/permissions.ts src/config/actionPermissions.ts src/config/navigation.ts
git commit -m "feat: add SETTINGS module and action permissions for admin/accountant"
```

---

### Task 3: Room Types — types, constants, server service

**Files:**
- Create: `src/modules/room-types/types.ts`
- Create: `src/modules/room-types/constants.ts`
- Create: `src/modules/room-types/services/roomTypeService.ts`
- Create: `src/modules/room-types/services/index.ts`
- Create: `src/modules/room-types/index.ts`

- [ ] **Step 1: Create types**

`src/modules/room-types/types.ts`:
```ts
import type { Tables, TablesInsert, TablesUpdate } from '@/services/supabase/database.types'

export type RoomTypeRow = Tables<'room_types'>
export type CreateRoomTypeInput = TablesInsert<'room_types'>
export type UpdateRoomTypeInput = TablesUpdate<'room_types'>

export interface RoomType {
  id: string
  name: string
  slug: string
  description: string | null
  basePrice: number
  defaultCapacity: number
  amenities: string[]
  createdAt: string
  updatedAt: string
}

export function mapRoomTypeRow(row: RoomTypeRow): RoomType {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    basePrice: Number(row.base_price),
    defaultCapacity: row.default_capacity,
    amenities: row.amenities as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toRoomTypeRow(input: CreateRoomTypeInput | UpdateRoomTypeInput): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if ('name' in input && input.name !== undefined) row.name = input.name
  if ('slug' in input && input.slug !== undefined) row.slug = input.slug
  if ('description' in input && input.description !== undefined) row.description = input.description
  if ('base_price' in input && input.base_price !== undefined) row.base_price = input.base_price
  if ('default_capacity' in input && input.default_capacity !== undefined) row.default_capacity = input.default_capacity
  if ('amenities' in input && input.amenities !== undefined) row.amenities = input.amenities
  return row
}
```

- [ ] **Step 2: Create constants**

`src/modules/room-types/constants.ts`:
```ts
export const ROOM_TYPES_PAGE_SIZE_OPTIONS = [10, 20, 50] as const
```

- [ ] **Step 3: Create server service**

`src/modules/room-types/services/roomTypeService.ts`:
```ts
import 'server-only'
import { createServerSupabaseClient } from '@/services/supabase/server'
import { createServiceRoleSupabaseClient } from '@/services/supabase/admin'
import { mapRoomTypeRow, toRoomTypeRow, type RoomType, type CreateRoomTypeInput, type UpdateRoomTypeInput } from '../types'
import { requireSettingsRead, requireSettingsWrite } from '@/modules/settings/services/serviceSecurity'

export async function listRoomTypes(): Promise<RoomType[]> {
  await requireSettingsRead()
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRoomTypeRow)
}

export async function getRoomType(id: string): Promise<RoomType | null> {
  await requireSettingsRead()
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data ? mapRoomTypeRow(data) : null
}

export async function createRoomType(input: CreateRoomTypeInput): Promise<RoomType> {
  await requireSettingsWrite()
  const supabase = createServiceRoleSupabaseClient()
  const { data, error } = await supabase
    .from('room_types')
    .insert(toRoomTypeRow(input))
    .select()
    .single()
  if (error) throw error
  return mapRoomTypeRow(data)
}

export async function updateRoomType(id: string, input: UpdateRoomTypeInput): Promise<RoomType> {
  await requireSettingsWrite()
  const supabase = createServiceRoleSupabaseClient()
  const { data, error } = await supabase
    .from('room_types')
    .update(toRoomTypeRow(input))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return mapRoomTypeRow(data)
}

export async function deleteRoomType(id: string): Promise<void> {
  await requireSettingsWrite()
  const supabase = createServiceRoleSupabaseClient()
  const { error } = await supabase
    .from('room_types')
    .delete()
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Create services barrel and module barrel**

`src/modules/room-types/services/index.ts`:
```ts
export * from './roomTypeService'
```

`src/modules/room-types/index.ts`:
```ts
export * from './types'
export * from './constants'
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/room-types/
git commit -m "feat(room-types): add types, constants, and server service"
```

---

### Task 4: Room Types — API routes

**Files:**
- Create: `src/app/api/room-types/route.ts`
- Create: `src/app/api/room-types/[id]/route.ts`

- [ ] **Step 1: Create collection route**

`src/app/api/room-types/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { listRoomTypes, createRoomType } from '@/modules/room-types/services'

export async function GET() {
  try {
    await authorizeRequest(undefined, ACTIONS.SETTINGS_READ)
    const data = await listRoomTypes()
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await validateCsrf(request)
    await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
    const body = await request.json()
    const data = await createRoomType(body)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('permission') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
```

- [ ] **Step 2: Create detail route**

`src/app/api/room-types/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { getRoomType, updateRoomType, deleteRoomType } from '@/modules/room-types/services'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorizeRequest(undefined, ACTIONS.SETTINGS_READ)
    const { id } = await params
    const data = await getRoomType(id)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await validateCsrf(request)
    await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
    const { id } = await params
    const body = await request.json()
    const data = await updateRoomType(id, body)
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('permission') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await validateCsrf(request)
    await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
    const { id } = await params
    await deleteRoomType(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('permission') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
```

- [ ] **Step 3: Create settings route guard**

Create `src/modules/settings/services/serviceSecurity.ts`:
```ts
import 'server-only'
import { getCurrentServerSession } from '@/services/auth/serverSession'
import { canPerformAction, assertPermission } from '@/config/access'
import { ACTIONS } from '@/config/actionPermissions'
import { AuthAccessError } from '@/types/auth'

export async function requireSettingsRead(): Promise<void> {
  const session = await getCurrentServerSession()
  if (!canPerformAction(session.role, ACTIONS.SETTINGS_READ)) {
    throw new AuthAccessError('auth/permission_denied', 'Settings read access denied')
  }
}

export async function requireSettingsWrite(): Promise<void> {
  const session = await getCurrentServerSession()
  if (!canPerformAction(session.role, ACTIONS.SETTINGS_WRITE)) {
    throw new AuthAccessError('auth/permission_denied', 'Settings write access denied')
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/room-types/ src/modules/settings/services/serviceSecurity.ts
git commit -m "feat(room-types): add API routes with auth guards"
```

---

### Task 5: Room Types — client API, hook, Redux slice

**Files:**
- Create: `src/modules/room-types/services/roomTypeApiClient.ts`
- Create: `src/modules/room-types/hooks/useRoomTypes.ts`
- Create: `src/modules/room-types/hooks/index.ts`
- Create: `src/modules/room-types/store/roomTypesSlice.ts`

- [ ] **Step 1: Create client API**

`src/modules/room-types/services/roomTypeApiClient.ts`:
```ts
import { createCrudApiClient } from '@/shared/crud'
import type { RoomType, CreateRoomTypeInput, UpdateRoomTypeInput } from '../types'

const roomTypesCrud = createCrudApiClient<RoomType, CreateRoomTypeInput, UpdateRoomTypeInput>({
  endpoint: '/api/room-types',
  defaultError: 'Failed to manage room type',
})

export const fetchRoomTypes = roomTypesCrud.list
export const getRoomType = roomTypesCrud.getById
export const createRoomTypeApi = roomTypesCrud.create
export const updateRoomTypeApi = roomTypesCrud.update
export const deleteRoomTypeApi = roomTypesCrud.delete
```

- [ ] **Step 2: Create hook**

`src/modules/room-types/hooks/useRoomTypes.ts`:
```ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RoomType, CreateRoomTypeInput, UpdateRoomTypeInput } from '../types'
import * as api from '../services/roomTypeApiClient'

interface RoomTypesState {
  items: RoomType[]
  loading: boolean
  error: string | null
}

export function useRoomTypes() {
  const [state, setState] = useState<RoomTypesState>({ items: [], loading: true, error: null })

  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const items = await api.fetchRoomTypes()
      setState({ items, loading: false, error: null })
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: error instanceof Error ? error.message : 'Failed to load room types' }))
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (input: CreateRoomTypeInput) => {
    const item = await api.createRoomTypeApi(input)
    setState(prev => ({ ...prev, items: [...prev.items, item] }))
    return item
  }, [])

  const update = useCallback(async (id: string, input: UpdateRoomTypeInput) => {
    const item = await api.updateRoomTypeApi(id, input)
    setState(prev => ({ ...prev, items: prev.items.map(i => i.id === id ? item : i) }))
    return item
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.deleteRoomTypeApi(id)
    setState(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }))
  }, [])

  return { ...state, create, update, remove, reload: load }
}
```

- [ ] **Step 3: Create hooks barrel**

`src/modules/room-types/hooks/index.ts`:
```ts
export { useRoomTypes } from './useRoomTypes'
```

- [ ] **Step 4: Create Redux slice**

`src/modules/room-types/store/roomTypesSlice.ts`:
```ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { RoomType, CreateRoomTypeInput, UpdateRoomTypeInput } from '../types'
import * as api from '../services/roomTypeApiClient'

interface RoomTypesState {
  items: RoomType[]
  loading: boolean
  error: string | null
}

const initialState: RoomTypesState = {
  items: [],
  loading: false,
  error: null,
}

export const fetchRoomTypes = createAsyncThunk('roomTypes/fetchAll', async () => {
  return await api.fetchRoomTypes()
})

export const createRoomTypeThunk = createAsyncThunk(
  'roomTypes/create',
  async (input: CreateRoomTypeInput) => {
    return await api.createRoomTypeApi(input)
  }
)

export const updateRoomTypeThunk = createAsyncThunk(
  'roomTypes/update',
  async ({ id, input }: { id: string; input: UpdateRoomTypeInput }) => {
    return await api.updateRoomTypeApi(id, input)
  }
)

export const deleteRoomTypeThunk = createAsyncThunk(
  'roomTypes/delete',
  async (id: string) => {
    await api.deleteRoomTypeApi(id)
    return id
  }
)

const roomTypesSlice = createSlice({
  name: 'roomTypes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoomTypes.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchRoomTypes.fulfilled, (state, action) => { state.loading = false; state.items = action.payload })
      .addCase(fetchRoomTypes.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load' })
      .addCase(createRoomTypeThunk.fulfilled, (state, action) => { state.items.push(action.payload) })
      .addCase(updateRoomTypeThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex(i => i.id === action.payload.id)
        if (idx >= 0) state.items[idx] = action.payload
      })
      .addCase(deleteRoomTypeThunk.fulfilled, (state, action) => {
        state.items = state.items.filter(i => i.id !== action.payload)
      })
  },
})

export default roomTypesSlice.reducer
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/room-types/services/roomTypeApiClient.ts src/modules/room-types/hooks/ src/modules/room-types/store/
git commit -m "feat(room-types): add client API, hook, and Redux slice"
```

---

### Task 6: Room Types tab component

**Files:**
- Create: `src/modules/room-types/components/RoomTypesTab.tsx`

- [ ] **Step 1: Create the tab component**

`src/modules/room-types/components/RoomTypesTab.tsx`:
```tsx
'use client'

import { useState, useCallback } from 'react'
import { useRoomTypes } from '../hooks'
import type { RoomType, CreateRoomTypeInput } from '../types'

export function RoomTypesTab() {
  const { items, loading, error, create, update, remove } = useRoomTypes()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateRoomTypeInput>({
    name: '',
    slug: '',
    description: null,
    base_price: 0,
    default_capacity: 2,
    amenities: [],
  })

  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm({ name: '', slug: '', description: null, base_price: 0, default_capacity: 2, amenities: [] })
  }, [])

  const handleEdit = useCallback((item: RoomType) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description,
      base_price: item.basePrice,
      default_capacity: item.defaultCapacity,
      amenities: item.amenities,
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await update(editingId, form)
      } else {
        await create(form)
      }
      resetForm()
    } catch {
      // error handled in hook
    }
  }, [editingId, form, create, update, resetForm])

  if (loading) return <div className="p-4 text-gray-500">Loading room types...</div>
  if (error) return <div className="p-4 text-red-500">{error}</div>

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold">{editingId ? 'Edit Room Type' : 'Add Room Type'}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Slug</label>
            <input
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Base Price ($)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.base_price}
              onChange={e => setForm(f => ({ ...f, base_price: Number(e.target.value) }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Default Capacity</label>
            <input
              type="number"
              min={1}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.default_capacity}
              onChange={e => setForm(f => ({ ...f, default_capacity: Number(e.target.value) }))}
              required
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))}
              rows={2}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            {editingId ? 'Update' : 'Create'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Slug</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Base Price</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Capacity</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-gray-500">{item.slug}</td>
                <td className="px-4 py-3 text-right">${item.basePrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">{item.defaultCapacity}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                  <button onClick={() => remove(item.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/room-types/components/RoomTypesTab.tsx
git commit -m "feat(room-types): add RoomTypesTab component with form and list"
```

---

### Task 7: Rooms — update types, migrate server service, add API client

**Files:**
- Modify: `src/modules/rooms/types.ts`
- Create: `src/modules/rooms/services/index.ts`
- Create: `src/modules/rooms/services/roomsApiClient.ts`

- [ ] **Step 1: Update Room types with room_type_id**

Read `src/modules/rooms/types.ts`. Update the `Room` interface:

```ts
export interface Room {
  id: string
  number: string
  floor: number
  roomTypeId: string  // was: type: RoomType
  status: RoomStatus
  price: number
  capacity: number
  amenities: string[]
}
```

Remove `RoomType` type/export (it's now managed via `room_types`). Keep `RoomStatus` and `RoomFilters`.

Add row mapping helpers:
```ts
import type { Tables, TablesInsert, TablesUpdate } from '@/services/supabase/database.types'

export type RoomRow = Tables<'rooms'>
export type CreateRoomInput = TablesInsert<'rooms'>
export type UpdateRoomInput = TablesUpdate<'rooms'>

export function mapRoomRow(row: RoomRow): Room {
  return {
    id: row.id,
    number: row.number,
    floor: row.floor,
    roomTypeId: row.room_type_id,
    status: row.status as RoomStatus,
    price: Number(row.price),
    capacity: row.capacity,
    amenities: row.amenities as string[],
  }
}
```

- [ ] **Step 2: Create rooms services barrel**

`src/modules/rooms/services/index.ts`:
```ts
export { roomService, type ListOptions } from '@/services/roomService'
```

- [ ] **Step 3: Create rooms API client**

`src/modules/rooms/services/roomsApiClient.ts`:
```ts
import { createCrudApiClient } from '@/shared/crud'
import type { Room, CreateRoomInput, UpdateRoomInput } from '../types'

const roomsCrud = createCrudApiClient<Room, CreateRoomInput, UpdateRoomInput>({
  endpoint: '/api/rooms',
  defaultError: 'Failed to manage room',
})

export const fetchRooms = roomsCrud.list
export const getRoom = roomsCrud.getById
export const createRoomApi = roomsCrud.create
export const updateRoomApi = roomsCrud.update
export const deleteRoomApi = roomsCrud.delete
```

- [ ] **Step 4: Update rooms module barrel**

`src/modules/rooms/index.ts` — add re-exports:
```ts
export * from './types'
export * from './services/roomsApiClient'
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/rooms/
git commit -m "feat(rooms): update types with room_type_id, add API client"
```

---

### Task 8: Rooms — API routes

**Files:**
- Create: `src/app/api/rooms/route.ts`
- Create: `src/app/api/rooms/[id]/route.ts`

- [ ] **Step 1: Create collection route**

`src/app/api/rooms/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { roomService } from '@/modules/rooms/services'

export async function GET() {
  try {
    await authorizeRequest(undefined, ACTIONS.SETTINGS_READ)
    const data = await roomService.getAll()
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await validateCsrf(request)
    await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
    const body = await request.json()
    const data = await roomService.create(body)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

- [ ] **Step 2: Create detail route**

`src/app/api/rooms/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { roomService } from '@/modules/rooms/services'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorizeRequest(undefined, ACTIONS.SETTINGS_READ)
    const { id } = await params
    const data = await roomService.getById(id)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await validateCsrf(request)
    await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
    const { id } = await params
    const body = await request.json()
    const data = await roomService.update(id, body)
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await validateCsrf(request)
    await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
    const { id } = await params
    await roomService.delete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/rooms/
git commit -m "feat(rooms): add API routes with auth guards"
```

---

### Task 9: Rooms — Redux slice and extended hook

**Files:**
- Create: `src/modules/rooms/store/roomsSlice.ts`
- Modify: `src/modules/rooms/hooks/useRooms.ts`

- [ ] **Step 1: Create Redux slice**

`src/modules/rooms/store/roomsSlice.ts`:
```ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { Room, CreateRoomInput, UpdateRoomInput } from '../types'
import * as api from '../services/roomsApiClient'

interface RoomsState {
  items: Room[]
  loading: boolean
  error: string | null
}

const initialState: RoomsState = {
  items: [],
  loading: false,
  error: null,
}

export const fetchRooms = createAsyncThunk('rooms/fetchAll', async () => {
  return await api.fetchRooms()
})

export const createRoomThunk = createAsyncThunk(
  'rooms/create',
  async (input: CreateRoomInput) => {
    return await api.createRoomApi(input)
  }
)

export const updateRoomThunk = createAsyncThunk(
  'rooms/update',
  async ({ id, input }: { id: string; input: UpdateRoomInput }) => {
    return await api.updateRoomApi(id, input)
  }
)

export const deleteRoomThunk = createAsyncThunk(
  'rooms/delete',
  async (id: string) => {
    await api.deleteRoomApi(id)
    return id
  }
)

const roomsSlice = createSlice({
  name: 'rooms',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRooms.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchRooms.fulfilled, (state, action) => { state.loading = false; state.items = action.payload })
      .addCase(fetchRooms.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load' })
      .addCase(createRoomThunk.fulfilled, (state, action) => { state.items.push(action.payload) })
      .addCase(updateRoomThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex(i => i.id === action.payload.id)
        if (idx >= 0) state.items[idx] = action.payload
      })
      .addCase(deleteRoomThunk.fulfilled, (state, action) => {
        state.items = state.items.filter(i => i.id !== action.payload)
      })
  },
})

export default roomsSlice.reducer
```

- [ ] **Step 2: Extend useRooms hook**

Read `src/modules/rooms/hooks/useRooms.ts`. Update to use the API client and support admin operations:

```ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Room, CreateRoomInput, UpdateRoomInput } from '../types'
import * as api from '../services/roomsApiClient'

export function useAdminRooms() {
  const [items, setItems] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.fetchRooms()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (input: CreateRoomInput) => {
    const item = await api.createRoomApi(input)
    setItems(prev => [...prev, item])
    return item
  }, [])

  const update = useCallback(async (id: string, input: UpdateRoomInput) => {
    const item = await api.updateRoomApi(id, input)
    setItems(prev => prev.map(i => i.id === id ? item : i))
    return item
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.deleteRoomApi(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  return { items, loading, error, create, update, remove, reload: load }
}
```

- [ ] **Step 3: Update hooks barrel**

Read `src/modules/rooms/hooks/index.ts`. Add:
```ts
export { useAdminRooms } from './useRooms'
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/rooms/store/ src/modules/rooms/hooks/
git commit -m "feat(rooms): add Redux slice and admin hook"
```

---

### Task 10: Rooms tab component

**Files:**
- Create: `src/modules/rooms/components/RoomsTab.tsx`

- [ ] **Step 1: Create RoomsTab component**

`src/modules/rooms/components/RoomsTab.tsx`:
```tsx
'use client'

import { useState, useCallback } from 'react'
import { useAdminRooms } from '../hooks'
import { useRoomTypes } from '@/modules/room-types/hooks'
import type { CreateRoomInput, UpdateRoomInput } from '../types'

export function RoomsTab() {
  const { items, loading, error, create, update, remove } = useAdminRooms()
  const { items: roomTypes } = useRoomTypes()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateRoomInput>({
    number: '',
    floor: 1,
    room_type_id: '',
    status: 'available',
    price: 0,
    capacity: 2,
    amenities: [],
  })

  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm({ number: '', floor: 1, room_type_id: '', status: 'available', price: 0, capacity: 2, amenities: [] })
  }, [])

  const handleEdit = useCallback((item: Room) => {
    setEditingId(item.id)
    setForm({
      number: item.number,
      floor: item.floor,
      room_type_id: item.roomTypeId,
      status: item.status,
      price: item.price,
      capacity: item.capacity,
      amenities: item.amenities,
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await update(editingId, form as UpdateRoomInput)
      } else {
        await create(form)
      }
      resetForm()
    } catch { /* handled */ }
  }, [editingId, form, create, update, resetForm])

  if (loading) return <div className="p-4 text-gray-500">Loading rooms...</div>
  if (error) return <div className="p-4 text-red-500">{error}</div>

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold">{editingId ? 'Edit Room' : 'Add Room'}</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Room Number</label>
            <input
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.number}
              onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Floor</label>
            <input
              type="number"
              min={0}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.floor}
              onChange={e => setForm(f => ({ ...f, floor: Number(e.target.value) }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Room Type</label>
            <select
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.room_type_id}
              onChange={e => setForm(f => ({ ...f, room_type_id: e.target.value }))}
              required
            >
              <option value="">Select type...</option>
              {roomTypes.map(rt => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Price ($)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Capacity</label>
            <input
              type="number"
              min={1}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.capacity}
              onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as Room['status'] }))}
            >
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
              <option value="cleaning">Cleaning</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            {editingId ? 'Update' : 'Create'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Room</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Floor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Price</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Capacity</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{item.number}</td>
                <td className="px-4 py-3 text-gray-500">{item.floor}</td>
                <td className="px-4 py-3 text-gray-500">
                  {roomTypes.find(rt => rt.id === item.roomTypeId)?.name ?? item.roomTypeId}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.status === 'available' ? 'bg-green-100 text-green-700' :
                    item.status === 'occupied' ? 'bg-blue-100 text-blue-700' :
                    item.status === 'maintenance' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>{item.status}</span>
                </td>
                <td className="px-4 py-3 text-right">${item.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">{item.capacity}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                  <button onClick={() => remove(item.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/rooms/components/RoomsTab.tsx
git commit -m "feat(rooms): add RoomsTab component with form and list"
```

---

### Task 11: Pricing — types, server service

**Files:**
- Create: `src/modules/pricing/types.ts`
- Create: `src/modules/pricing/services/pricingService.ts`
- Create: `src/modules/pricing/services/index.ts`
- Create: `src/modules/pricing/index.ts`

- [ ] **Step 1: Create types**

`src/modules/pricing/types.ts`:
```ts
import type { Tables, TablesInsert, TablesUpdate } from '@/services/supabase/database.types'

export type PricingRow = Tables<'room_type_pricing'>
export type CreatePricingInput = TablesInsert<'room_type_pricing'>
export type UpdatePricingInput = TablesUpdate<'room_type_pricing'>

export interface RoomTypePricing {
  id: string
  roomTypeId: string
  price: number
  currency: string
  effectiveFrom: string | null
  effectiveUntil: string | null
  createdAt: string
  updatedAt: string
}

export function mapPricingRow(row: PricingRow): RoomTypePricing {
  return {
    id: row.id,
    roomTypeId: row.room_type_id,
    price: Number(row.price),
    currency: row.currency,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

- [ ] **Step 2: Create server service**

`src/modules/pricing/services/pricingService.ts`:
```ts
import 'server-only'
import { createServerSupabaseClient } from '@/services/supabase/server'
import { createServiceRoleSupabaseClient } from '@/services/supabase/admin'
import { mapPricingRow, type RoomTypePricing, type CreatePricingInput, type UpdatePricingInput } from '../types'
import { requireSettingsRead, requireSettingsWrite } from '@/modules/settings/services/serviceSecurity'

export async function listPricing(): Promise<RoomTypePricing[]> {
  await requireSettingsRead()
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('room_type_pricing')
    .select('*')
    .order('room_type_id', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapPricingRow)
}

export async function getPricingByType(roomTypeId: string): Promise<RoomTypePricing[]> {
  await requireSettingsRead()
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('room_type_pricing')
    .select('*')
    .eq('room_type_id', roomTypeId)
  if (error) throw error
  return (data ?? []).map(mapPricingRow)
}

export async function createPricing(input: CreatePricingInput): Promise<RoomTypePricing> {
  await requireSettingsWrite()
  const supabase = createServiceRoleSupabaseClient()
  const { data, error } = await supabase
    .from('room_type_pricing')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return mapPricingRow(data)
}

export async function updatePricing(id: string, input: UpdatePricingInput): Promise<RoomTypePricing> {
  await requireSettingsWrite()
  const supabase = createServiceRoleSupabaseClient()
  const { data, error } = await supabase
    .from('room_type_pricing')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return mapPricingRow(data)
}

export async function deletePricing(id: string): Promise<void> {
  await requireSettingsWrite()
  const supabase = createServiceRoleSupabaseClient()
  const { error } = await supabase
    .from('room_type_pricing')
    .delete()
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 3: Create barrels**

`src/modules/pricing/services/index.ts`:
```ts
export * from './pricingService'
```

`src/modules/pricing/index.ts`:
```ts
export * from './types'
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/pricing/
git commit -m "feat(pricing): add types and server service"
```

---

### Task 12: Pricing — API routes, client API, hook, Redux slice

**Files:**
- Create: `src/app/api/pricing/route.ts`
- Create: `src/app/api/pricing/[id]/route.ts`
- Create: `src/modules/pricing/services/pricingApiClient.ts`
- Create: `src/modules/pricing/hooks/usePricing.ts`
- Create: `src/modules/pricing/hooks/index.ts`
- Create: `src/modules/pricing/store/pricingSlice.ts`

- [ ] **Step 1: Create collection route**

`src/app/api/pricing/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { listPricing, createPricing } from '@/modules/pricing/services'

export async function GET() {
  try {
    await authorizeRequest(undefined, ACTIONS.SETTINGS_READ)
    const data = await listPricing()
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await validateCsrf(request)
    await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
    const body = await request.json()
    const data = await createPricing(body)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

- [ ] **Step 2: Create detail route**

`src/app/api/pricing/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { updatePricing, deletePricing } from '@/modules/pricing/services'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await validateCsrf(request)
    await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
    const { id } = await params
    const body = await request.json()
    const data = await updatePricing(id, body)
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await validateCsrf(request)
    await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
    const { id } = await params
    await deletePricing(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

- [ ] **Step 3: Create client API**

`src/modules/pricing/services/pricingApiClient.ts`:
```ts
import { createCrudApiClient } from '@/shared/crud'
import type { RoomTypePricing, CreatePricingInput, UpdatePricingInput } from '../types'

const pricingCrud = createCrudApiClient<RoomTypePricing, CreatePricingInput, UpdatePricingInput>({
  endpoint: '/api/pricing',
  defaultError: 'Failed to manage pricing',
})

export const fetchPricing = pricingCrud.list
export const createPricingApi = pricingCrud.create
export const updatePricingApi = pricingCrud.update
export const deletePricingApi = pricingCrud.delete
```

- [ ] **Step 4: Create hook**

`src/modules/pricing/hooks/usePricing.ts`:
```ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RoomTypePricing, CreatePricingInput, UpdatePricingInput } from '../types'
import * as api from '../services/pricingApiClient'

export function usePricing() {
  const [items, setItems] = useState<RoomTypePricing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.fetchPricing()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (input: CreatePricingInput) => {
    const item = await api.createPricingApi(input)
    setItems(prev => [...prev, item])
    return item
  }, [])

  const update = useCallback(async (id: string, input: UpdatePricingInput) => {
    const item = await api.updatePricingApi(id, input)
    setItems(prev => prev.map(i => i.id === id ? item : i))
    return item
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.deletePricingApi(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  return { items, loading, error, create, update, remove, reload: load }
}
```

`src/modules/pricing/hooks/index.ts`:
```ts
export { usePricing } from './usePricing'
```

- [ ] **Step 5: Create Redux slice**

`src/modules/pricing/store/pricingSlice.ts`:
```ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { RoomTypePricing, CreatePricingInput, UpdatePricingInput } from '../types'
import * as api from '../services/pricingApiClient'

interface PricingState {
  items: RoomTypePricing[]
  loading: boolean
  error: string | null
}

const initialState: PricingState = {
  items: [],
  loading: false,
  error: null,
}

export const fetchPricingData = createAsyncThunk('pricing/fetchAll', async () => {
  return await api.fetchPricing()
})

export const createPricingThunk = createAsyncThunk(
  'pricing/create',
  async (input: CreatePricingInput) => await api.createPricingApi(input)
)

export const updatePricingThunk = createAsyncThunk(
  'pricing/update',
  async ({ id, input }: { id: string; input: UpdatePricingInput }) => await api.updatePricingApi(id, input)
)

export const deletePricingThunk = createAsyncThunk(
  'pricing/delete',
  async (id: string) => { await api.deletePricingApi(id); return id }
)

const pricingSlice = createSlice({
  name: 'pricing',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPricingData.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchPricingData.fulfilled, (state, action) => { state.loading = false; state.items = action.payload })
      .addCase(fetchPricingData.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load' })
      .addCase(createPricingThunk.fulfilled, (state, action) => { state.items.push(action.payload) })
      .addCase(updatePricingThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex(i => i.id === action.payload.id)
        if (idx >= 0) state.items[idx] = action.payload
      })
      .addCase(deletePricingThunk.fulfilled, (state, action) => {
        state.items = state.items.filter(i => i.id !== action.payload)
      })
  },
})

export default pricingSlice.reducer
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/pricing/ src/modules/pricing/services/pricingApiClient.ts src/modules/pricing/hooks/ src/modules/pricing/store/
git commit -m "feat(pricing): add API routes, client API, hook, and Redux slice"
```

---

### Task 13: Pricing tab component

**Files:**
- Create: `src/modules/pricing/components/PricingTab.tsx`

- [ ] **Step 1: Create PricingTab component**

`src/modules/pricing/components/PricingTab.tsx`:
```tsx
'use client'

import { useState, useCallback } from 'react'
import { usePricing } from '../hooks'
import { useRoomTypes } from '@/modules/room-types/hooks'
import type { CreatePricingInput } from '../types'

export function PricingTab() {
  const { items, loading, error, create, update, remove } = usePricing()
  const { items: roomTypes } = useRoomTypes()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreatePricingInput>({
    room_type_id: '',
    price: 0,
    currency: 'USD',
    effective_from: null,
    effective_until: null,
  })

  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm({ room_type_id: '', price: 0, currency: 'USD', effective_from: null, effective_until: null })
  }, [])

  const handleEdit = useCallback((item: RoomTypePricing) => {
    setEditingId(item.id)
    setForm({
      room_type_id: item.roomTypeId,
      price: item.price,
      currency: item.currency,
      effective_from: item.effectiveFrom,
      effective_until: item.effectiveUntil,
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await update(editingId, form)
      } else {
        await create(form)
      }
      resetForm()
    } catch { /* handled */ }
  }, [editingId, form, create, update, resetForm])

  const getTypeName = useCallback((typeId: string) => {
    return roomTypes.find(rt => rt.id === typeId)?.name ?? typeId
  }, [roomTypes])

  if (loading) return <div className="p-4 text-gray-500">Loading pricing...</div>
  if (error) return <div className="p-4 text-red-500">{error}</div>

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold">{editingId ? 'Edit Pricing' : 'Add Pricing'}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Room Type</label>
            <select
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.room_type_id}
              onChange={e => setForm(f => ({ ...f, room_type_id: e.target.value }))}
              required
            >
              <option value="">Select type...</option>
              {roomTypes.map(rt => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Price</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Effective From</label>
            <input
              type="date"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.effective_from ?? ''}
              onChange={e => setForm(f => ({ ...f, effective_from: e.target.value || null }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Effective Until</label>
            <input
              type="date"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.effective_until ?? ''}
              onChange={e => setForm(f => ({ ...f, effective_until: e.target.value || null }))}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            {editingId ? 'Update' : 'Create'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Room Type</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Price</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Currency</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Effective</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{getTypeName(item.roomTypeId)}</td>
                <td className="px-4 py-3 text-right">${item.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-500">{item.currency}</td>
                <td className="px-4 py-3 text-gray-500 text-sm">
                  {item.effectiveFrom ? `${item.effectiveFrom.slice(0, 10)}` : 'Current'}
                  {item.effectiveUntil ? ` — ${item.effectiveUntil.slice(0, 10)}` : ''}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                  <button onClick={() => remove(item.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/pricing/components/PricingTab.tsx
git commit -m "feat(pricing): add PricingTab component with form and list"
```

---

### Task 14: Add settings icon to LayoutIcons and navigation types

**Files:**
- Modify: `src/components/layout/LayoutIcons.tsx`
- Modify: `src/config/navigation.ts`

- [ ] **Step 1: Add "settings" to DashboardNavIcon type and icon mapping**

Read `src/config/navigation.ts`. Add `'settings'` to the `DashboardNavIcon` union type:
```ts
export type DashboardNavIcon = 'dashboard' | 'users' | 'contacts' | 'reservations' | 'accounting' | 'logs' | 'settings'
```

- [ ] **Step 2: Add settings icon SVG**

Read `src/components/layout/LayoutIcons.tsx`. Add a `SettingsIcon` component (if one doesn't exist already) and add it to the `ICONS` map:

```tsx
function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
```

Then add to the `ICONS` map:
```tsx
export const ICONS: Record<DashboardNavIcon, React.FC> = {
  // ...existing
  settings: SettingsIcon,
}
```

- [ ] **Step 3: Commit**

```bash
git add src/config/navigation.ts src/components/layout/LayoutIcons.tsx
git commit -m "feat(nav): add settings icon and type to navigation system"
```

---

### Task 15: SettingsPage — tab container

**Files:**
- Create: `src/modules/settings/components/SettingsPage.tsx`

Also need to create the settings page route and add the tab to the existing Settings tab route.

- [ ] **Step 1: Create SettingsPage component**

`src/modules/settings/components/SettingsPage.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { RoomTypesTab } from '@/modules/room-types/components/RoomTypesTab'
import { RoomsTab } from '@/modules/rooms/components/RoomsTab'
import { PricingTab } from '@/modules/pricing/components/PricingTab'

type SettingsTab = 'room-types' | 'rooms' | 'pricing'

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'room-types', label: 'Room Types' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'pricing', label: 'Pricing' },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('room-types')

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-black text-black'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      {activeTab === 'room-types' && <RoomTypesTab />}
      {activeTab === 'rooms' && <RoomsTab />}
      {activeTab === 'pricing' && <PricingTab />}
    </div>
  )
}
```

- [ ] **Step 2: Create the settings page route**

Create `src/app/[locale]/dashboard/settings/page.tsx`:
```tsx
import { SettingsPage } from '@/modules/settings/components/SettingsPage'

export default function SettingsRoutePage() {
  return <SettingsPage />
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/settings/ src/app/[locale]/dashboard/settings/page.tsx
git commit -m "feat(settings): add SettingsPage tab container and route"
```

---

### Task 16: i18n translation keys

**Files:**
- Modify: `src/i18n/locales/en/common.json`
- Modify: `src/i18n/locales/ar/common.json`

- [ ] **Step 1: Add English translations**

Read `src/i18n/locales/en/common.json`. Add:
```json
{
  "nav": {
    "settings": "Settings"
  },
  "settings": {
    "title": "Settings"
  },
  "roomTypes": {
    "title": "Room Types",
    "name": "Name",
    "slug": "Slug",
    "description": "Description",
    "basePrice": "Base Price",
    "defaultCapacity": "Default Capacity",
    "amenities": "Amenities"
  },
  "rooms": {
    "title": "Rooms"
  },
  "pricing": {
    "title": "Pricing",
    "perNight": "Per Night",
    "currency": "Currency",
    "effectiveFrom": "Effective From",
    "effectiveUntil": "Effective Until"
  }
}
```

- [ ] **Step 2: Add Arabic translations**

Read `src/i18n/locales/ar/common.json`. Add:
```json
{
  "nav": {
    "settings": "الإعدادات"
  },
  "settings": {
    "title": "الإعدادات"
  },
  "roomTypes": {
    "title": "أنواع الغرف",
    "name": "الاسم",
    "slug": "المعرف",
    "description": "الوصف",
    "basePrice": "السعر الأساسي",
    "defaultCapacity": "السعة الافتراضية",
    "amenities": "وسائل الراحة"
  },
  "rooms": {
    "title": "الغرف"
  },
  "pricing": {
    "title": "التسعير",
    "perNight": "ليلة",
    "currency": "العملة",
    "effectiveFrom": "ساري من",
    "effectiveUntil": "ساري حتى"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/en/common.json src/i18n/locales/ar/common.json
git commit -m "feat(i18n): add settings, room types, and pricing translations"
```

---

### Task 17: Verify — build check

- [ ] **Step 1: Run the build**

Run: `npm run build`

Expected: Build succeeds with no TypeScript errors. Verify the new pages, API routes, and components compile cleanly.

- [ ] **Step 2: Fix any errors**

If there are type errors (e.g., `src/services/roomService.ts` still references the old `Room` type with `type` field), update the service to use `room_type_id` instead of the old column.

- [ ] **Step 3: Run graphify update**

```bash
graphify update .
```

Expected: Graph rebuilds without errors, reflecting new module structure.
