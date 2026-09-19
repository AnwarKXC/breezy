# Roles & Permissions Reference

> **Last updated:** 2026-07-06
> **Source files:** `src/config/roles.ts`, `src/config/permissions.ts`, `src/config/actionPermissions.ts`, `src/config/access.ts`, `src/config/navigation.ts`, and Supabase RLS policies in `supabase/migrations/`.

---

## System Roles

Three staff roles control access to the hotel management system. Each Supabase auth user is assigned exactly one role via the `profiles` table.

| Role | Constant | Value | Default? | Description |
|---|---|---|---|---|
| **Admin** | `ROLES.ADMIN` | `admin` | — | Full system access — users, settings, logs, all operations |
| **Accountant** | `ROLES.ACCOUNTANT` | `accountant` | — | Financial operations — accounting, invoices, expenses, reports, read-only on most other domains |
| **Front Desk** | `ROLES.FRONT_DESK` | `front_desk` | ✅ Default | Day-to-day hotel operations — reservations, check-in/out, guests, bookings |

**Source:** `src/config/roles.ts`

---

## Module-Level Access (Navigation / Pages)

Controls which sidebar and bottom-nav items each role can see. Defined in `PERMISSIONS` (`src/config/permissions.ts`) and enforced by the proxy middleware (`src/proxy.ts`).

| Module | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Users | `PERMISSION_MODULES.USERS` | ✅ | ❌ | ❌ |
| Accounting | `PERMISSION_MODULES.ACCOUNTING` | ✅ | ✅ | ❌ |
| Reservations | `PERMISSION_MODULES.RESERVATIONS` | ✅ | ✅ | ✅ |
| Contacts | `PERMISSION_MODULES.CONTACTS` | ✅ | ✅ | ✅ |
| Logs | `PERMISSION_MODULES.LOGS` | ✅ | ❌ | ❌ |
| Settings | `PERMISSION_MODULES.SETTINGS` | ✅ | ✅ | ❌ |

**Source:** `src/config/permissions.ts`, `src/config/navigation.ts`

---

## Action-Level Permissions

Granular action-based permissions covering 40+ specific operations. Defined in `ACTIONS` (`src/config/actionPermissions.ts`) and checked via `canPerformAction()` (`src/config/access.ts`).

### Legend

| Symbol | Meaning |
|---|---|
| ✅ | Allowed |
| ❌ | Denied |
| — | Not applicable |

### General & Dashboard

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Dashboard Read | `ACTIONS.DASHBOARD_READ` | ✅ | ✅ | ✅ |

### Legacy Bookings

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Bookings Read | `ACTIONS.BOOKINGS_READ` | ✅ | ✅ | ✅ |
| Bookings Write | `ACTIONS.BOOKINGS_WRITE` | ✅ | ❌ | ✅ |

### Guests

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Guests Read | `ACTIONS.GUESTS_READ` | ✅ | ✅ | ✅ |
| Guests Write | `ACTIONS.GUESTS_WRITE` | ✅ | ❌ | ✅ |

### Rooms

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Rooms Read | `ACTIONS.ROOMS_READ` | ✅ | ❌ | ✅ |

> **Note:** At the database RLS level, `private.can_read_rooms()` also includes `accountant` (updated by `20260515000000_audit_fixes.sql`), though there is no app-layer action for accountant room reads.

### Accounting

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Accounting Read | `ACTIONS.ACCOUNTING_READ` | ✅ | ✅ | ✅ |
| Accounting Write | `ACTIONS.ACCOUNTING_WRITE` | ✅ | ✅ | ❌ |
| Accounting Reports | `ACTIONS.ACCOUNTING_REPORTS` | ✅ | ✅ | ❌ |
| Accounting Export | `ACTIONS.ACCOUNTING_EXPORT` | ✅ | ✅ | ❌ |

### Invoices

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Invoices Create | `ACTIONS.INVOICES_CREATE` | ✅ | ✅ | ✅ |
| Invoices Update | `ACTIONS.INVOICES_UPDATE` | ✅ | ✅ | ✅ |
| Invoices Issue | `ACTIONS.INVOICES_ISSUE` | ✅ | ✅ | ✅ |
| Invoices Void | `ACTIONS.INVOICES_VOID` | ✅ | ✅ | ❌ |
| Invoices Refund | `ACTIONS.INVOICES_REFUND` | ✅ | ✅ | ❌ |
| Invoices Adjust | `ACTIONS.INVOICES_ADJUST` | ✅ | ✅ | ❌ |

### Payments

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Payments Create | `ACTIONS.PAYMENTS_CREATE` | ✅ | ✅ | ✅ |
| Payments Refund | `ACTIONS.PAYMENTS_REFUND` | ✅ | ✅ | ❌ |

### Expenses

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Expenses Create | `ACTIONS.EXPENSES_CREATE` | ✅ | ✅ | ❌ |
| Expenses Update | `ACTIONS.EXPENSES_UPDATE` | ✅ | ✅ | ❌ |
| Expenses Approve | `ACTIONS.EXPENSES_APPROVE` | ✅ | ✅ | ❌ |
| Expenses Void | `ACTIONS.EXPENSES_VOID` | ✅ | ✅ | ❌ |

### Ledger

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Ledger Read | `ACTIONS.LEDGER_READ` | ✅ | ✅ | ❌ |

### Users

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Users Create | `ACTIONS.USERS_CREATE` | ✅ | ❌ | ❌ |
| Users Read | `ACTIONS.USERS_READ` | ✅ | ❌ | ❌ |
| Users Update | `ACTIONS.USERS_UPDATE` | ✅ | ❌ | ❌ |
| Users Delete | `ACTIONS.USERS_DELETE` | ✅ | ❌ | ❌ |

### Logs

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Logs Read | `ACTIONS.LOGS_READ` | ✅ | ❌ | ❌ |

> **Enforcement detail:** The logs API (`src/app/api/logs/route.ts`, line 107-110) also restricts non-admin users from filtering logs by arbitrary userId — they can only see their own records.

### Contacts

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Contacts Create | `ACTIONS.CONTACTS_CREATE` | ✅ | ❌ | ✅ |
| Contacts Read | `ACTIONS.CONTACTS_READ` | ✅ | ✅ | ✅ |
| Contacts Update | `ACTIONS.CONTACTS_UPDATE` | ✅ | ❌ | ✅ |
| Contacts Delete | `ACTIONS.CONTACTS_DELETE` | ✅ | ❌ | ✅ |
| Price Overrides Update | `ACTIONS.CONTACTS_PRICE_OVERRIDES_UPDATE` | ✅ | ✅ | ❌ |

### Settings

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Settings Read | `ACTIONS.SETTINGS_READ` | ✅ | ✅ | ❌ |
| Settings Write | `ACTIONS.SETTINGS_WRITE` | ✅ | ✅ | ❌ |
| Accounting Settings | `ACTIONS.ACCOUNTING_SETTINGS` | ✅ | ✅ | ❌ |

### Reservations

| Action | Code Constant | Admin | Accountant | Front Desk |
|---|---|---|---|---|
| Reservations Read | `ACTIONS.RESERVATIONS_READ` | ✅ | ✅ | ✅ |
| Reservations Create | `ACTIONS.RESERVATIONS_CREATE` | ✅ | ❌ | ✅ |
| Reservations Update Draft | `ACTIONS.RESERVATIONS_UPDATE_DRAFT` | ✅ | ❌ | ✅ |
| Reservations Confirm | `ACTIONS.RESERVATIONS_CONFIRM` | ✅ | ❌ | ✅ |
| Reservations Cancel | `ACTIONS.RESERVATIONS_CANCEL` | ✅ | ❌ | ✅ |
| Reservations Check In | `ACTIONS.RESERVATIONS_CHECK_IN` | ✅ | ❌ | ✅ |
| Reservations Check Out | `ACTIONS.RESERVATIONS_CHECK_OUT` | ✅ | ❌ | ✅ |
| Reservations No Show | `ACTIONS.RESERVATIONS_NO_SHOW` | ✅ | ❌ | ✅ |
| Reservations Extend | `ACTIONS.RESERVATIONS_EXTEND` | ✅ | ❌ | ✅ |
| Reservations Room Change | `ACTIONS.RESERVATIONS_ROOM_CHANGE` | ✅ | ❌ | ✅ |
| Reservations Override Pricing | `ACTIONS.RESERVATIONS_OVERRIDE_PRICING` | ✅ | ❌ | ❌ |
| Reservations Manage Billing | `ACTIONS.RESERVATIONS_MANAGE_BILLING` | ✅ | ❌ | ❌ |
| Reservations Add Note | `ACTIONS.RESERVATIONS_ADD_NOTE` | ✅ | ❌ | ✅ |
| Reservations Record Payment | `ACTIONS.RESERVATIONS_RECORD_PAYMENT` | ✅ | ✅ | ✅ |
| Reservations Refund | `ACTIONS.RESERVATIONS_REFUND` | ✅ | ✅ | ❌ |
| Reservations View Audit | `ACTIONS.RESERVATIONS_VIEW_AUDIT` | ✅ | ✅ | ❌ |

**Source:** `src/config/actionPermissions.ts`

---

## Database-Level Permissions (Supabase RLS)

Row-Level Security is enforced at the Postgres level using helper functions in the `private` schema. These are the **final authority** — even if an app-level check passes, the database will reject unauthorized operations.

### RLS Helper Functions

Each function uses `private.current_app_role()` to read the authenticated user's role from the `profiles` table.

| Function | Roles Allowed | Applies To (Tables) | Defined In Migration |
|---|---|---|---|
| **can_read_logs** | admin | `audit_logs` | `20260511222709` |
| **can_read_bookings** | admin, accountant, front_desk | `bookings` | `20260511222709` |
| **can_write_bookings** | admin, front_desk | `bookings` (insert/update/delete) | `20260511222709` |
| **can_read_rooms** | admin, accountant, front_desk | `rooms` | `20260512120000` (updated by `20260515000000`) |
| **can_write_rooms** | admin | `rooms` (insert/update/delete) | `20260512120000` |
| **can_read_guests** | admin, accountant, front_desk | `guests` | `20260512120000` |
| **can_write_guests** | admin, front_desk | `guests` (insert/update/delete) | `20260512120000` |
| **can_read_contacts** | admin, accountant, front_desk | `contacts` | `20260514000000` (updated by `20260515000000`) |
| **can_write_contacts** | admin, front_desk | `contacts` (insert/update/delete) | `20260514000000` |
| **can_read_company_price_overrides** | admin, accountant, front_desk | `company_price_overrides` | `20260515000000` |
| **can_write_company_price_overrides** | admin | `company_price_overrides` (insert/update/delete) | `20260514000000` |
| **can_read_invoices** | admin, accountant | `invoices` | `20260516000000` |
| **can_write_invoices** | admin | `invoices` (insert/update/delete) | `20260516000000` |
| **can_read_room_types** | admin, accountant | `room_types`, `room_type_pricing` | `20260520000000` |
| **can_write_room_types** | admin, accountant | `room_types`, `room_type_pricing` (insert/update/delete) | `20260520000000` |
| **can_read_reservations** | admin, accountant, front_desk | `reservations`, `reservation_rooms`, `reservation_guests`, `reservation_company_info`, `reservation_pricing_items`, `reservation_payments`, `reservation_holds`, `reservation_notes`, `reservation_status_history` | `20260630000001` |
| **can_write_reservations** | admin, front_desk | All reservation tables (insert/update/delete) | `20260630000001` |
| **can_manage_pricing** | admin | Pricing-related reservation fields | `20260630000001` |
| **can_override_pricing** | admin, front_desk | Override pricing on reservations | `20260630000001` |
| **can_manage_deposit_policies** | admin | `deposit_policy_rules` | `20260630000001` |

### Accounting Tables (Direct Inline RLS)

The accounting tables use inline `EXISTS` checks rather than separate helper functions:

| Table | Roles Allowed | Operations |
|---|---|---|
| `payments` | admin, accountant | ALL |
| `expense_categories` | admin, accountant | ALL |
| `expenses` | admin, accountant | ALL |

**Source:** `20260602000004_add_accounting_rls_and_seed.sql`

### Profiles Table (Auth Users)

| Operation | Policy | Allowed Roles |
|---|---|---|
| SELECT | `profiles_select_own_or_admin` | Own profile (any role) OR admin (all) |
| INSERT | `profiles_insert_admin` | admin only |
| UPDATE | `profiles_update_admin` | admin only |
| DELETE | `profiles_delete_admin` | admin only |

**Source:** `20260511222709_harden_initial_app_schema.sql`

---

## Permission Enforcement Layers

The system enforces permissions at four levels:

```
┌────────────────────────────────────────────────────────────────┐
│  LAYER 1: PROXY / MIDDLEWARE  (src/proxy.ts)                  │
│  └─ Intercepts all /{locale}/... dashboard requests            │
│  └─ Checks module-level access via canAccessModule()           │
│  └─ Redirects to /unauthorized on failure                      │
├────────────────────────────────────────────────────────────────┤
│  LAYER 2: SUPABASE RLS  (Postgres policies)                   │
│  └─ 24+ tables with RLS enabled                               │
│  └─ Helper functions: private.can_read_* / can_write_*        │
│  └─ Source of truth: profiles.role                            │
│  └─ Last line of defense — rejects at database level           │
├────────────────────────────────────────────────────────────────┤
│  LAYER 3: API ROUTE GUARDS  (secureEndpoint / routeAuth)      │
│  └─ Action-level checks via canPerformAction()                 │
│  └─ Returns 403 Forbidden or 401 Unauthorized                  │
│  └─ Used by all domain API routes                              │
├────────────────────────────────────────────────────────────────┤
│  LAYER 4: SERVER COMPONENT & UI GUARDS                        │
│  └─ Server: requireModuleAccess() / requirePermission()        │
│  └─ Client: Redux role + conditional button rendering          │
│  └─ Nav items filtered by module access in Sidebar/BottomNav   │
└────────────────────────────────────────────────────────────────┘
```

---

## Guest Roles (Non-Auth Users)

These roles apply to **reservation guests** (people staying at the hotel), not system users. Stored in the `reservation_guest_role` / `guest_role` Postgres enum.

| Role | Description |
|---|---|
| `primary_guest` / `primary` | Main guest on the reservation |
| `additional_guest` / `adult` | Accompanying adult guest |
| `company_guest` | Guest booked under a company/contact |
| `child` | Minor guest |

**Source:** `20260630000001_add_reservation_schema.sql`, `database.types.ts`

---

## Summary: Quick Reference by Role

### Admin — Full System Access

**Can access modules:** Users, Accounting, Reservations, Contacts, Logs, Settings

**Can perform ALL actions** (all 40+ actions). Includes: user CRUD, logs read, expense approval, reservation override pricing, billing management, invoice full lifecycle, settings write.

**Database write access:** All 24+ tables.

### Accountant — Financial Operations

**Can access modules:** Accounting, Reservations, Contacts, Settings

**Can perform:** Dashboard read, bookings/guests/contacts read, full accounting CRUD, invoices (create/update/issue/void/refund/adjust), payments (create/refund), expenses (full lifecycle), ledger read, settings (read/write), reservations read + view audit + record payment + refund, contacts price overrides update.

**Database write access:** Invoices (read-only at DB level!), accounting tables (payments, expenses, expense_categories), room_types + room_type_pricing.

**Cannot:** Write bookings/guests, manage contacts CRUD, access users, read logs, perform reservation operations (no create/confirm/cancel/check-in/etc.).

### Front Desk — Hotel Operations

**Can access modules:** Reservations, Contacts

**Can perform:** Dashboard read, bookings (read/write), guests (read/write), rooms read, invoices (create/update/issue), payments create, contacts (full CRUD), full reservation operations (create/confirm/cancel/check-in/check-out/no-show/extend/room-change/add-note/record-payment).

**Database write access:** Bookings, guests, contacts, all reservation tables.

**Cannot:** Access users, logs, accounting, settings modules. No expense/ledger access. No invoicing void/refund/adjust. No reservation pricing override or billing management.
