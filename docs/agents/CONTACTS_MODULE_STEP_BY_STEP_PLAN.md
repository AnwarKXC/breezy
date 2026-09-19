# Contacts Module Step-by-Step Implementation Plan

Project: `hotel-system`  
Source graph: `GRAPH_REPORT.md`  
Primary rule: follow `system-restrictions.md` and reuse the existing `shared/` folder before creating anything new.

---

## 0. Non-Negotiable Rules for the Agent

Before coding, the agent must read:

1. `system-restrictions.md`
2. `GRAPH_REPORT.md`
3. Existing `shared/` folder
4. Existing modules that already solve similar problems, especially:
   - users module
   - bookings/reservations module
   - logs/audit module
   - existing contacts placeholder module

The agent must not create new components, utilities, hooks, services, styles, table systems, analytics cards, inputs, dialogs, pagination, upload helpers, or layout wrappers until it has checked whether the same thing already exists in `shared/`, `modules/users`, `modules/bookings`, or another current module.

If a reusable item exists, use it.  
If it almost fits, extend it safely without breaking existing usage.  
Create a new file only when reuse is impossible or would make the shared component worse.

---

## 1. Step 1 — Inspect Current System Structure

### Goal
Understand the current app structure before implementation.

### Required checks

The agent must inspect:

- `shared/`
- `shared/components/`
- `shared/analytics/`
- `shared/types/`
- `shared/hooks/`
- `shared/utils/`
- `shared/services/`
- existing table components
- existing card components
- existing form inputs
- existing toolbar/filter components
- existing modal/dialog components
- existing pagination components
- existing loading/skeleton components
- existing empty/error states
- existing upload/storage helpers
- existing analytics/stat cards
- existing RBAC helpers
- existing route protection methods
- existing reservation price logic

### Output before coding
The agent must write a short checklist:

```md
## Reuse Checklist
- Shared components found:
- Shared analytics found:
- Existing form components found:
- Existing table/grid components found:
- Existing route/RBAC methods found:
- Existing reservation pricing methods found:
- New files that are truly needed:
```

Do not start coding until this checklist is created.

---

## 2. Step 2 — Confirm Existing Design System

### Goal
Make the Contacts module look exactly like the current system.

### Reuse first
Use existing design patterns from:

- `shared/components`
- users page layout
- bookings page layout
- dashboard cards
- existing placeholder contacts page
- toolbar/view-toggle components from the graph:
  - `FloatingInput`
  - `FloatingSelect`
  - `GridViewIcon`
  - `RowViewIcon`
  - `ToolbarAction`
  - `ToolbarFilter`
- table system from the graph:
  - `Table`
  - `TableMobileView`
  - `TablePagination`
  - `Card`
  - `Skeleton`

### Design constraints
Use the existing visual language:

- page background: light gray/blue system background
- white cards
- rounded `2xl` cards
- subtle shadows
- consistent spacing
- same button variants
- same input style
- same table style
- same mobile responsiveness
- same loading and empty state style

### Forbidden
Do not create a second design system.  
Do not add random UI libraries.  
Do not create new table/card/input components if existing shared ones can be used.

---

## 3. Step 3 — Define Contacts Data Model

### Goal
Create the data model for hotel clients.

Contacts must support two types:

1. Company
2. Individual

### Company fields

- name
- logo uploaded to Supabase storage
- phone
- country
- city
- responsible person
- email optional

### Individual fields

- name
- phone
- ID/passport
- email

### Company price override fields

Required defaults:

- Standard Single
- Standard Double
- Standard Triple
- Deluxe Single
- Deluxe Double
- Deluxe Triple

The implementation should not be hardcoded in a way that blocks hotels from using custom room labels later, for example:

- seaview
- sideview
- camp

### Recommended model
Use a separate price override table/collection instead of only six fixed fields.

Example logical model:

```ts
type ContactType = 'company' | 'individual';
type OccupancyCode = 'S' | 'D' | 'T';

type CompanyPriceOverride = {
  id: string;
  contactId: string;
  roomCategory: string; // standard, deluxe, seaview, sideview, camp
  occupancyCode: OccupancyCode;
  price: number;
  currency?: string;
};
```

### Reuse first
Before creating new types, check existing shared/global types and generated Supabase types.

---

## 4. Step 4 — Database and Supabase Storage

### Goal
Add database support and company logo storage.

### Required work

- create/update `contacts` table
- create/update `company_price_overrides` table
- add indexes for search/filtering
- add timestamps
- add soft-delete if the system already uses soft-delete
- add Supabase storage bucket for company logos if no existing bucket/helper can be reused
- add RLS policies matching existing system security

### Reuse first
Use existing:

- Supabase client creation methods
- server client methods
- storage helper methods
- auth session helpers
- RLS style
- migration naming convention
- generated database type pattern

### Storage rules

- Logos are only for company contacts.
- Use the existing upload validation method if available.
- Validate image type and size using current system restrictions.
- Store only the path in the database, not the full public URL unless the current system already does this.

---

## 5. Step 5 — Permissions and Restrictions

### Goal
Protect contacts according to existing RBAC/module rules.

### Required permissions

Add or reuse permission actions equivalent to:

```ts
contacts.view
contacts.create
contacts.update
contacts.delete
contacts.priceOverrides.update
contacts.logo.upload
```

### Reuse first
Use existing graph/RBAC methods:

- `requireModuleAccess()`
- `enforceModuleAccess()`
- `canAccessModule()`
- `canPerformAction()`
- `assertPermission()`
- existing `ACTION_PERMISSIONS`
- existing navigation permissions

### Special rule
Only authorized internal users can edit company price overrides.  
Reservation flow can read company override prices but must not edit them.

---

## 6. Step 6 — Service Layer and API Layer

### Goal
Implement CRUD without creating a parallel architecture.

### Required operations

- list contacts
- get contact by ID
- create company contact
- create individual contact
- update contact
- delete contact
- upload/update company logo
- list contact history
- update company price overrides
- get company price override for reservation flow

### Reuse first
Use current patterns from users/bookings:

- API client pattern
- server-service pattern
- CRUD response envelope
- error handling helpers
- validation helpers
- pagination/list options
- filters/search pattern
- logging/audit helper

### Forbidden
Do not call Supabase directly from random client components if the system uses services/server actions/API routes.

---

## 7. Step 7 — Validation

### Goal
Validate Company and Individual forms with existing validation style.

### Company validation

- name required
- phone required
- country required
- city required
- responsible person required
- email optional but valid if provided
- logo optional or required depending on business decision
- price fields numeric and non-negative

### Individual validation

- name required
- phone required
- ID/passport required
- email required and valid

### Reuse first
Use existing validation library, schemas, error message style, and form error components.

---

## 8. Step 8 — Contacts List Page

### Goal
Replace the placeholder Contacts page with the real module.

### Route
Use the current localized dashboard route style. Expected logical route:

```txt
/contacts
```

or, if the project uses localized dashboard nesting:

```txt
/[locale]/dashboard/contacts
```

Follow the existing project route structure exactly.

### Required UI

- page header
- analytics/stat section if other modules use it
- search input
- type filter: all/company/individual
- grid/table view toggle
- create contact button
- grid cards
- table view
- pagination if existing modules use pagination
- loading state
- empty state
- error state

### Reuse first
Use:

- shared analytics/stat cards from `shared/analytics`
- shared toolbar components
- shared table components
- shared card components
- shared skeleton/loading components
- shared empty states
- existing users/bookings page layout pattern

### New components only if needed
Only create contact-specific wrappers such as:

- `ContactCard`
- `ContactsTableColumns`
- `ContactTypeBadge`

Do not create new generic card/table/input components.

---

## 9. Step 9 — Add/Edit Contact Forms

### Goal
Support adding and editing Company and Individual contacts.

### Required behavior

- choose contact type
- dynamically show Company fields or Individual fields
- support logo upload for Company
- support price override editor for Company
- hide price override editor for Individual
- validate before save
- show existing system toast/notification pattern
- redirect or refresh using current routing style

### Reuse first
Use existing:

- form components
- input components
- select components
- upload components
- modal/drawer/page form pattern
- toast/notification methods
- loading button state

### Price editor
Use existing table/input components.  
Create only the minimum contact-specific wrapper needed to render override rows.

---

## 10. Step 10 — Grid View and Table View Toggle

### Goal
Implement dual view mode.

### Required behavior

- grid view shows contact cards
- table view shows contact rows
- toggle persists using the same method existing modules use, if available
- mobile behavior follows existing table/mobile card pattern

### Reuse first
Use existing graph components:

- `GridViewIcon`
- `RowViewIcon`
- `ToolbarAction`
- `Table`
- `TableMobileView`
- `Card`

### Forbidden
Do not build another table implementation.

---

## 11. Step 11 — Dynamic Contact Details Route

### Goal
Clicking a contact opens its details page.

### Route

```txt
/contacts/:id
```

or the localized equivalent used by the app.

### Required sections

- contact header
- contact type badge
- company logo if Company
- phone/email
- company location/responsible person
- individual ID/passport
- company price overrides if Company
- full contact history
- related reservations/bookings if available
- edit/delete actions based on permission

### Reuse first
Use existing dynamic details pattern from users module and booking history methods if available.

---

## 12. Step 12 — Contact History

### Goal
Show full contact history on `/contacts/:id`.

### History should include where available

- created date
- updated date
- audit log events
- reservations/bookings connected to this contact
- price override changes if the logs system supports it
- logo changes if the logs system supports it

### Reuse first
Use existing logs/audit services and existing history UI from users/details page if available.

### Do not create
Do not create a separate audit system for contacts.

---

## 13. Step 13 — Reservation Price Override Integration

### Goal
Reservation flow must use company prices when a Company contact is selected.

### Required behavior

When reservation contact/client is a Company:

1. find matching company price override by room category and occupancy
2. use override price if found
3. otherwise fall back to normal hotel/room price
4. show price source clearly if the current UI supports it
5. do not allow reservation users to edit company override prices from the reservation flow

### Reuse first
Use existing reservation pricing methods.  
Do not duplicate price calculation logic.  
Add a small extension/helper only where needed.

### Example priority

```txt
company override price > hotel room price > default room price
```

---

## 14. Step 14 — Analytics Integration

### Goal
Use existing `shared/analytics` instead of creating new analytics UI.

### Contacts analytics may include

- total contacts
- company contacts
- individual contacts
- contacts with active reservations
- companies with price overrides

### Reuse first
Use existing analytics card/stat components and existing data-building pattern.

### Forbidden
Do not create new analytics card styles if `shared/analytics` already has reusable cards.

---

## 15. Step 15 — Navigation and Module Access

### Goal
Make Contacts accessible from current navigation and protected by module access.

### Required work

- update Contacts nav item only if needed
- keep existing Contacts icon if present
- use existing `NAV_ITEMS`
- use existing `ContactsIcon`
- use existing `canAccessModule()` logic
- protect page with existing server-side module access method

### Reuse first
Use graph Community 31 navigation/module access patterns.

---

## 16. Step 16 — Files and Folder Structure

### Preferred structure
Follow the project’s existing module folder style. If the app uses `modules/`, prefer:

```txt
src/modules/contacts/
  components/
  hooks/
  services/
  types.ts
  validators.ts
  constants.ts
  index.ts
```

If the app uses `features/`, follow the existing pattern instead.

### Shared folder rule
Anything generic must go to or reuse `shared/`.  
Anything contact-specific stays inside the contacts module.

### Examples

Contact-specific:

- `ContactCard`
- `ContactTypeBadge`
- `CompanyPriceOverridesEditor`

Shared/reusable:

- generic table
- generic card shell
- generic analytics card
- generic file uploader
- generic confirm dialog
- generic toolbar filters
- generic empty state

---

## 17. Step 17 — Testing and Verification

### Required checks after each major step

Run available commands from the project, for example:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use the actual package scripts in `package.json`.

### Manual checks

- create Company contact
- upload Company logo
- create Individual contact
- edit Company contact
- edit Individual contact
- delete contact
- view contacts in grid mode
- view contacts in table mode
- open `/contacts/:id`
- check contact history
- confirm Company price override appears in reservation flow
- confirm unauthorized users cannot edit Company prices
- confirm reservation users cannot edit Company prices from reservation flow
- confirm mobile layout works
- confirm RTL/localized layout still works if the system supports i18n

---

## 18. Agent Execution Prompt

Use this prompt for the coding agent:

```md
You are implementing the Contacts / Hotel Clients module.

Before coding, read:
1. system-restrictions.md
2. GRAPH_REPORT.md
3. CONTACTS_MODULE_STEP_BY_STEP_PLAN.md
4. The full shared/ folder, especially shared/analytics and shared/components
5. Existing users, bookings/reservations, logs, auth, and navigation modules

Main rule:
Reuse every existing component, method, hook, utility, service pattern, analytics card, table, toolbar, form input, modal, pagination, loading, empty state, RBAC helper, and Supabase helper before creating anything new.

Do not create a new component or method unless:
- no reusable version exists, or
- the existing version cannot be extended safely, or
- the new file is contact-specific and not generic.

Implementation steps:
1. Produce a reuse checklist before coding.
2. Confirm route/module structure.
3. Add database/schema/storage changes.
4. Add RLS and permissions.
5. Add service/API layer using existing patterns.
6. Add validators using existing validation style.
7. Build contacts list page using existing shared layout, analytics, toolbar, table, and card components.
8. Build Add/Edit/Delete/View flows.
9. Build grid/table toggle using existing icons and toolbar methods.
10. Build /contacts/:id details route using existing dynamic details pattern.
11. Add contact history using existing logs/audit/history methods.
12. Add Company price override editor with Standard S/D/T and Deluxe S/D/T defaults.
13. Support custom room categories without hardcoding the system to only six fields.
14. Integrate Company price overrides into reservation price calculation.
15. Run lint/typecheck/tests/build using package.json scripts.
16. Return summary of files changed, reused components, new files created, tests run, and limitations.

Forbidden:
- Do not create a second design system.
- Do not duplicate table/card/input/dialog/pagination/analytics components.
- Do not bypass system-restrictions.md.
- Do not bypass RBAC/RLS.
- Do not put server-only logic in client components.
- Do not edit Company prices from reservation flow.
```

---

## 19. Final Acceptance Criteria

The module is complete only when:

- Contacts CRUD works.
- Company and Individual data requirements are enforced.
- Company logos upload through Supabase using existing storage patterns.
- Grid and table views work using reusable components.
- Clicking a contact opens `/contacts/:id` or the app’s localized equivalent.
- Contact details show full history.
- Company has editable Standard S/D/T and Deluxe S/D/T price overrides.
- Price model can support custom labels like seaview, sideview, and camp.
- Reservation flow uses Company price overrides.
- Only authorized internal users can edit Company prices.
- Existing shared components and methods are reused wherever possible.
- `system-restrictions.md` is followed.
- Lint/typecheck/build pass or documented issues are explained.
