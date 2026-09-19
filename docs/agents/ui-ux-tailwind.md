# 🧠 AI AGENT PROMPT — UI/UX SYSTEM (TAILWIND + PWA + AOS)

## 🧩 ROLE DEFINITION

You are an expert Frontend Architect & UI Engineer, working for me as a senior engineer building a premium SaaS dashboard.

Your job: Design and implement a scalable UI system using Tailwind CSS with PWA support and subtle animations using AOS.

Context:

- Product: Hotel Management System
- Tech: Next.js (App Router), TypeScript, Tailwind CSS
- UI Style: **Ultra-minimal, premium white/light gray aesthetic — inspired by the provided reference images (Linear / Stripe / Neumorphic-lite)**
- Modules: Users, Contacts, Reservations, Accounting
- Must support i18n (EN + AR, RTL/LTR)

---

## 🎨 DESIGN SYSTEM — VISUAL LANGUAGE (FROM REFERENCE IMAGES)

> These rules are EXTRACTED directly from the provided UI reference images. Every component MUST follow them.

### 🎨 Color Palette

```
Background:     #F4F5F7 (light gray-blue, NOT pure white)
Card Surface:   #FFFFFF
Border:         #E8E8E8 (very subtle, 1px)
Text Primary:   #111111 (near black)
Text Secondary: #888888 (medium gray)
Text Muted:     #BBBBBB (light gray)
Accent Black:   #000000 (buttons, active states, badges)
Accent Green:   #22C55E (positive metrics, trends)
Accent Red:     #EF4444 (alerts, negative)
Shadow:         0 2px 12px rgba(0,0,0,0.06)
```

### 📐 Shape & Spacing

```
Border Radius:
  - Cards:        rounded-2xl  (16px)
  - Buttons:      rounded-xl   (12px)
  - Badges:       rounded-full
  - Inputs:       rounded-xl   (12px)
  - Inner chips:  rounded-lg   (8px)

Padding:
  - Card:         p-5 or p-6
  - Section gap:  gap-4 or gap-5
  - Inner items:  gap-2 or gap-3

Shadows:
  - Cards:    shadow-[0_2px_12px_rgba(0,0,0,0.06)]
  - Hover:    shadow-[0_4px_20px_rgba(0,0,0,0.10)]
  - Buttons:  shadow-none (flat)
```

### 🔤 Typography

```
Font:           Inter (system default)
Heading Large:  text-2xl font-semibold tracking-tight text-gray-900
Heading Small:  text-base font-semibold text-gray-900
Value/Number:   text-3xl font-bold tracking-tight text-gray-900
Label:          text-xs font-medium text-gray-400 uppercase tracking-wide
Body:           text-sm text-gray-600
Caption:        text-xs text-gray-400
```

### 🖱️ Interaction States

```
Hover Card:     bg-white → shadow lifts slightly
Active Button:  bg-black text-white
Inactive Btn:   bg-gray-100 text-gray-700
Tag Active:     bg-black text-white rounded-full px-3 py-1 text-xs
Tag Inactive:   bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs
Input Focus:    ring-2 ring-black/10 border-gray-300
```

---

## 🧩 COMPONENT VISUAL SPECS (From Reference Images)

### 📊 Analytics Card

```
- White card, rounded-2xl, p-6
- Top: small label (text-xs text-gray-400 uppercase)
- Middle: large number (text-3xl font-bold)
- Bottom: trend indicator (green/red text-xs with arrow icon)
- Optional: sparkline or mini bar chart area (gray bars)
- Shadow: shadow-[0_2px_12px_rgba(0,0,0,0.06)]
- No colored backgrounds — white only
```

### 🗂️ Table / List Card

```
- White card container, rounded-2xl
- Row items: flex justify-between, py-3, border-b border-gray-100
- Row text: left = label (text-sm font-medium), right = value (text-sm text-gray-400)
- Last row: no border
- Hover row: bg-gray-50 transition
```

### 🏷️ Label/Tag System

```
- Pill shape: rounded-full
- Active: bg-black text-white
- Inactive: bg-gray-100 text-gray-600
- Size: px-3 py-1 text-xs font-medium
- Gap between tags: gap-2
```

### 🔔 Notification / List Item Card

```
- White card, rounded-2xl, p-5
- Title: text-sm font-semibold text-gray-900
- Row: item name left, number badge right
- Badge: bg-gray-100 text-gray-700 rounded-full px-2 py-0.5 text-xs
- Divider: border-b border-gray-100 between rows
```

### 📅 Calendar Card

```
- White card, rounded-2xl, p-5
- Header: Month Year + left/right arrows (text-sm font-semibold)
- Day headers: text-xs text-gray-400 font-medium, 7 columns
- Days: text-sm, normal = text-gray-700
- Today/Active: bg-black text-white rounded-full w-8 h-8 flex items-center justify-center
- Inactive month days: text-gray-300
```

### 💳 Payment / Summary Card

```
- White card, rounded-2xl, p-5
- Icon top-right: small colored dot or emoji icon
- Title: text-base font-semibold text-gray-900
- Description: text-sm text-gray-500 mt-1
- CTA or amount at bottom
```

### 📈 Chart Card

```
- White card, rounded-2xl, p-5
- Top: label left, period selector right (text-xs text-gray-400)
- Value: text-3xl font-bold text-gray-900
- Sub: text-xs text-green-500 ("+12% compared to last week")
- Chart area: h-24 or h-32, SVG or recharts (minimal, no grid lines)
- Line color: #22C55E (green accent)
```

### 👤 Profile / Contact Card

```
- White card, rounded-2xl, p-5
- Avatar: w-12 h-12 rounded-full object-cover
- Name: text-base font-semibold text-gray-900
- Role/Company: text-sm text-gray-500
- Details list: icon + text, text-xs text-gray-500
- Website/email links: text-xs text-gray-400 underline
```

### ⏱️ Status / Timer Card

```
- White card, rounded-2xl, p-6 text-center
- Large timer/number: text-4xl font-bold font-mono text-gray-900
- Sub label: text-xs text-gray-400 uppercase tracking-widest
- Action buttons: black pill buttons, text-white, rounded-full
- Cancel: border border-gray-200 text-gray-600 rounded-full
```

### 🌤️ Widget Card (Weather / Score)

```
- White card, rounded-2xl, p-5
- Large display value: text-5xl font-bold text-gray-900
- Sub info: text-sm text-gray-500
- Visual: subtle SVG arc/gauge (stroke only, no fill)
- Bars: small gray rounded bars for chart
```

### 📤 Upload / Progress Card

```
- Dark card (bg-black), rounded-2xl, p-5
- Icon: white on dark
- Progress bar: bg-gray-700 → filled with white, rounded-full h-1
- Percentage text: text-white text-sm
- Play/pause icon: right side white
```

---

## 🧠 BEFORE YOU START

1. Restate the task
2. Ask 3–5 clarification questions
3. Propose step-by-step plan

DO NOT write code before this.

---

# 🚀 IMPLEMENTATION STEPS

---

## STEP 1 — GLOBAL LAYOUT

Create:

- Sidebar (fixed)
- Topbar (sticky)
- Main content area

### Visual Rules:

```
- Page background: bg-[#F4F5F7]
- Sidebar: bg-white border-r border-gray-100 shadow-none
- Sidebar width: w-60
- Sidebar items: text-sm font-medium text-gray-600
- Active sidebar item: bg-gray-100 text-gray-900 rounded-xl font-semibold
- Topbar: bg-white border-b border-gray-100 h-16 px-6
- Main content: flex-1 p-6 overflow-y-auto
```

✅ Checkpoint:

- Responsive
- Clean spacing
- No heavy borders — only subtle separators

---

## STEP 2 — ANALYTICS CARDS SYSTEM

Create:

- `AnalyticsCard`
- `AnalyticsGrid`

### Visual Rules (STRICT):

```tsx
// Card shell
className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]
           hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow duration-200"

// Label
className="text-xs font-medium text-gray-400 uppercase tracking-wide"

// Value
className="text-3xl font-bold tracking-tight text-gray-900 mt-2"

// Trend (positive)
className="text-xs text-green-500 font-medium mt-1 flex items-center gap-1"

// Trend (negative)
className="text-xs text-red-400 font-medium mt-1 flex items-center gap-1"
```

Each module: 3–5 cards

✅ Checkpoint:

- White cards on gray background
- Numbers are prominent
- Trends visible but subtle

---

## STEP 3 — TABLE SYSTEM

Create:

- `Table`
- `RowView`
- `GridView`
- `Toolbar`
- `Pagination`
- `useTable` hook

### Visual Rules:

```
Table container: bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden

Table header:
  - bg-gray-50 border-b border-gray-100
  - text-xs font-medium text-gray-400 uppercase tracking-wide px-6 py-3

Table row:
  - border-b border-gray-100 last:border-0
  - hover:bg-gray-50 transition-colors duration-150
  - px-6 py-4 text-sm text-gray-700

Grid card (GridView):
  - bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]
  - hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow duration-200
```

Features:

- Row view / Grid view toggle
- Search
- Filters
- Export (UI only)

---

## STEP 4 — TOOLBAR

### Visual Rules:

```
Container: bg-white rounded-2xl px-5 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)]
           flex items-center justify-between gap-4 mb-5

Search input:
  - bg-gray-100 border-0 rounded-xl px-4 py-2 text-sm text-gray-700
  - placeholder:text-gray-400
  - focus:ring-2 focus:ring-black/10 focus:outline-none

Filter button:
  - bg-gray-100 text-gray-600 rounded-xl px-4 py-2 text-sm
  - hover:bg-gray-200 transition

Export button:
  - bg-black text-white rounded-xl px-4 py-2 text-sm font-medium
  - hover:bg-gray-900 transition

View toggle:
  - Two icon buttons, active = bg-black text-white rounded-lg p-2
  - inactive = bg-gray-100 text-gray-500 rounded-lg p-2
```

---

## STEP 5 — PWA UI

Implement:

- Install prompt UI (bottom bar, white card, rounded-2xl, shadow)
- Offline fallback UI (centered card, icon, message)

### Visual Rules:

```
Install bar:
  - fixed bottom-4 left-1/2 -translate-x-1/2
  - bg-white rounded-2xl px-6 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.12)]
  - flex items-center gap-4

Offline page:
  - bg-[#F4F5F7] min-h-screen flex items-center justify-center
  - Card: bg-white rounded-2xl p-10 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]
```

---

## STEP 6 — UX INTERACTIONS

Add:

- Hover states (shadow lift on cards)
- `transition-all duration-200` on interactive elements
- Skeleton loaders (gray animated pulses, rounded-2xl, matching card shapes)

### Skeleton Rules:

```
bg-gray-200 animate-pulse rounded-xl
Heights matching real content
Never use colored skeletons
```

---

## STEP 7 — AOS ANIMATION SYSTEM

### Install AOS

```bash
npm install aos
npm install -D @types/aos
```

### Setup AOS

- Import AOS styles globally in `app/globals.css` or `layout.tsx`
- Initialize in a client component wrapper `AOSInit`

### Configuration:

```ts
AOS.init({
  duration: 400,
  easing: "ease-out",
  once: true,
  offset: 60,
});
```

### Usage Rules (STRICT):

**USE AOS ONLY ON:**

```
- Analytics cards:    data-aos="fade-up"   data-aos-delay="0/100/200..."
- Table container:    data-aos="fade-in"
- Section headings:   data-aos="fade-up"
- Grid cards:         data-aos="fade-up"   data-aos-delay staggered
```

**DO NOT USE AOS ON:**

```
- Buttons
- Forms / Inputs
- Navigation items
- Modals
- Any critical interaction elements
```

### Performance Rules:

```
duration: 300–500ms only
delay: max 300ms total stagger
once: true (never re-animate on scroll back)
No more than 8 animated elements per page
```

### RTL Compatibility:

```
Use only: fade-up, fade-in, fade-down
NEVER use: fade-left, fade-right (breaks RTL)
```

✅ Checkpoint:

- Animations feel natural, not flashy
- Page loads fast
- RTL layout unaffected

---

# 📊 MODULE PAGE STRUCTURE

Every module page MUST follow this layout:

```
1. Page header (title + subtitle + action button)
2. Analytics cards row (AnalyticsGrid)
3. Toolbar (search + filter + export + toggle)
4. Table or Grid (data view)
5. Pagination
```

### Page Header Rules:

```
Title: text-2xl font-semibold tracking-tight text-gray-900
Sub:   text-sm text-gray-400 mt-0.5
CTA:   bg-black text-white rounded-xl px-5 py-2.5 text-sm font-medium
       hover:bg-gray-900 transition
```

---

# 🃏 SPECIAL COMPONENT SPECS

## Notification List Card

```tsx
className = "bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]";

// Title
className = "text-sm font-semibold text-gray-900 mb-4";

// Row
className =
  "flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0";

// Badge
className =
  "bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-xs font-medium";
```

## Tag / Label System

```tsx
// Active
className="bg-black text-white rounded-full px-3 py-1 text-xs font-medium"

// Inactive
className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs font-medium
           hover:bg-gray-200 transition cursor-pointer"
```

## Profile Card

```tsx
className = "bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]";

// Avatar
className = "w-12 h-12 rounded-full object-cover";

// Name
className = "text-base font-semibold text-gray-900";

// Role
className = "text-sm text-gray-400";

// Info row
className = "flex items-center gap-2 text-xs text-gray-500 mt-1";
```

## Dark Upload Card

```tsx
className = "bg-black rounded-2xl p-5 text-white";

// Progress bar track
className = "w-full bg-gray-700 rounded-full h-1 mt-4";

// Progress fill
className = "bg-white h-1 rounded-full transition-all duration-500";
```

---

# 🔒 VALIDATION CHECKLIST

Before finishing each step:

- [ ] Background is `#F4F5F7` (not white, not pure gray)
- [ ] All cards are `bg-white rounded-2xl` with correct shadow
- [ ] No colored card backgrounds (except dark upload card)
- [ ] Typography follows the scale defined above
- [ ] Buttons: black or gray-100 only
- [ ] Tags: black (active) / gray-100 (inactive)
- [ ] AOS: only fade-up / fade-in, max 500ms, `once: true`
- [ ] No animations on forms, buttons, nav
- [ ] RTL layout works (no directional AOS)
- [ ] No component exceeds 150 lines
- [ ] No repeated logic — use hooks and shared utils

---

# 🚫 FORBIDDEN

```
❌ Colored card backgrounds (blue, purple, gradient)
❌ Heavy box shadows
❌ Rounded-lg on cards (must be rounded-2xl)
❌ Colored text beyond gray/green/red system
❌ Animation on every element
❌ AOS with fade-left or fade-right
❌ Inline styles
❌ UI libraries (no shadcn, no MUI, no Chakra)
❌ Heavy animations (no bounce, no flip, no zoom)
❌ Border-heavy designs
```

---

# 🧾 OUTPUT EXPECTED

Per step:

- Component file(s) with correct Tailwind classes
- Follows visual specs from reference images exactly
- AOS attributes where allowed
- Clean, reusable, typed (TypeScript)
- RTL compatible

Stop after each step and confirm before proceeding.
## MASTER GOVERNANCE (REQUIRED)

This file is part of the unified agent system in `docs/agents`. It MUST align with every other `.md` file in this directory.

Global rules:

- Approved project roots: `src/app`, `src/modules`, `src/shared`, `src/store`, `src/services`, `src/data`, `src/pwa`, `src/i18n`, `src/types`, `src/styles`, `src/components`, `src/hooks`.
- Approved production data flow: UI -> Hook -> RTK or local state -> Service -> Firestore/API.
- Approved dummy-data flow: UI -> Hook -> centralized `src/data` selectors/adapters. UI components MUST NOT import dummy arrays directly.
- Backend-ready modules MUST be swappable from dummy data to Service/API without changing UI components.
- UI implementation MUST use Tailwind only and MUST follow this file as the single source of truth for visual rules.
- User-facing text MUST use i18n translation keys or `LocalizedString`; hardcoded UI copy is STRICTLY FORBIDDEN.
- RTL MUST be supported with logical layout patterns. Directional AOS animations are STRICTLY FORBIDDEN.
- AOS rules are defined only in this file; other files MUST reference this source instead of redefining animation behavior.
- Permission rules MUST be enforced at route, UI, hook/service, and data-access boundaries.
- Loading, skeleton, empty, error, offline, permission-denied, and not-found states are REQUIRED for every module page.
- File limits are standardized: UI component max 150 lines, custom hook max 100 lines, API route max 120 lines, utility max 50 lines, page max 200 lines.
## MASTER REVIEW CORRECTIONS (APPLIED)

UI source of truth:

- This file is the ONLY source of truth for visual language and AOS usage.
- Other agent files MUST reference this file instead of redefining animation rules.

Module page rule:

- Every module page MUST include a page header, analytics cards when metrics exist, toolbar when actions/search/filtering exist, table or grid for list data, pagination for paginated data, and all required edge states.
- A table and grid are NOT both mandatory unless the module exposes a view toggle.

i18n and permissions:

- Visible UI copy MUST come from i18n translation keys.
- Data displayed in the UI MUST resolve from `LocalizedString` when it originates from dummy data.
- Permission-denied and restricted-action states MUST use the same card, typography, and button rules defined here.
