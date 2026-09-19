# 🧠 AI AGENT PROMPT — PROJECT STRUCTURE (RTK + PWA + i18n)

## 🧩 ROLE DEFINITION

You are an expert Full-Stack Architect, working for me as a senior engineer designing a scalable SaaS system with multilingual support.

Your job: Generate a production-ready project structure using Next.js, Redux Toolkit, Firebase, PWA, and full i18n support (English + Arabic with RTL).

Context:

- Product: Hotel Management System
- Users: Staff (dashboard)
- Languages:
  - English (LTR)
  - Arabic (RTL)

- Stack:
  - Next.js App Router
  - TypeScript
  - Redux Toolkit
  - Firebase (later)

- UI: Tailwind-based

Constraints:

- Must support RTL/LTR switching
- Must support dynamic language switching
- Must be scalable for more languages
- Must follow file size limits
- Must be modular
- Must support PWA
- Must NOT use outdated i18n patterns

---

## 🧠 BEFORE YOU START

1. Restate the task
2. Ask 3–5 clarification questions
3. Propose structure plan

DO NOT generate code before this.

---

# 🚀 IMPLEMENTATION STEPS

---

## STEP 1 — ROOT STRUCTURE (WITH i18n)

Create:

```id="root"
src/
├── app/
│   ├── [locale]/                 # 🔥 dynamic locale routing
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   └── layout.tsx
│   │
│   └── layout.tsx
│
├── modules/
├── shared/
├── store/
├── services/
├── pwa/
├── i18n/                        # 🔥 translations & config
├── types/
├── styles/
```

✅ Checkpoint:

- Locale-based routing exists
- Clean separation

---

## STEP 2 — i18n SYSTEM

Create:

```id="i18n"
src/i18n/
├── config.ts
├── provider.tsx
├── hooks/
│   └── useTranslation.ts
├── locales/
│   ├── en.json
│   └── ar.json
```

---

### Requirements:

- Store translations in JSON files
- Use key-based translations:
  - "users.title"
  - "dashboard.revenue"

---

### Example:

```json id="example-en"
{
  "users": {
    "title": "Users"
  }
}
```

```json id="example-ar"
{
  "users": {
    "title": "المستخدمين"
  }
}
```

---

## STEP 3 — RTL / LTR SUPPORT

Implement:

- Auto direction switching:
  - English → `dir="ltr"`
  - Arabic → `dir="rtl"`

---

### In layout:

- Dynamically set:
  - `lang`
  - `dir`

---

### Tailwind Rules:

- Use logical spacing where possible
- Avoid fixed `ml` / `mr` (prefer `gap`, `flex`)

---

## STEP 4 — LANGUAGE SWITCHER

Create:

- UI component:
  - Dropdown or toggle

Features:

- Switch between:
  - English
  - Arabic

- Persist language (localStorage or cookie)

---

## STEP 5 — PWA SETUP

Create:

- manifest.json
- service worker
- offline fallback

---

## STEP 6 — REDUX TOOLKIT

Create:

- Store structure
- Add optional:
  - `uiSlice` for language state

---

## STEP 7 — MODULE STRUCTURE

Each module remains:

```id="module"
modules/{module}/
├── components/
├── hooks/
├── services/
├── store/
├── types.ts
└── index.ts
```

---

## STEP 8 — SHARED SYSTEMS

Create:

```id="shared"
shared/
├── table/
├── analytics/
├── components/
├── hooks/
└── utils/
```

---

## STEP 9 — PAGE STRUCTURE

Each page MUST use:

- AnalyticsGrid
- Toolbar
- Table

---

## STEP 10 — DATA FLOW

Production: UI → Hook → RTK or local state → Service → Firestore/API
Dummy mode: UI → Hook → centralized `src/data` selectors/adapters

---

## 🔒 VALIDATION

Before finishing:

- RTL works correctly
- Language switch works
- Layout adapts correctly
- No hardcoded text
- All text comes from i18n

---

## 🚫 FORBIDDEN

- Hardcoded UI text
- Mixing languages in code
- Ignoring RTL layout issues

---

## 🧾 OUTPUT EXPECTED

- Full folder structure
- i18n system
- Language switcher
- RTL support
- Example translation usage

Stop after each step and confirm.
## MASTER GOVERNANCE (REQUIRED)

This file is part of the unified agent system in `docs/agents`. It MUST align with every other `.md` file in this directory.

Global rules:

- Approved project roots: `src/app`, `src/modules`, `src/shared`, `src/store`, `src/services`, `src/data`, `src/pwa`, `src/i18n`, `src/types`, `src/styles`, `src/components`, `src/hooks`.
- Approved production data flow: UI -> Hook -> RTK or local state -> Service -> Firestore/API.
- Approved dummy-data flow: UI -> Hook -> centralized `src/data` selectors/adapters. UI components MUST NOT import dummy arrays directly.
- Backend-ready modules MUST be swappable from dummy data to Service/API without changing UI components.
- UI implementation MUST use Tailwind only and MUST follow `ui-ux-tailwind.md`.
- User-facing text MUST use i18n translation keys or `LocalizedString`; hardcoded UI copy is STRICTLY FORBIDDEN.
- RTL MUST be supported with logical layout patterns. Directional AOS animations are STRICTLY FORBIDDEN.
- AOS rules are defined only in `ui-ux-tailwind.md`; other files MUST reference that source instead of redefining animation behavior.
- Permission rules MUST be enforced at route, UI, hook/service, and data-access boundaries.
- Loading, skeleton, empty, error, offline, permission-denied, and not-found states are REQUIRED for every module page.
- File limits are standardized: UI component max 150 lines, custom hook max 100 lines, API route max 120 lines, utility max 50 lines, page max 200 lines.
## MASTER REVIEW CORRECTIONS (APPLIED)

The canonical root structure MUST include `src/data`:

```txt
src/
  app/
  components/
  data/
  hooks/
  i18n/
  modules/
  pwa/
  services/
  shared/
  store/
  styles/
  types/
```

Corrected data flow:

- Production: UI -> Hook -> RTK or local state -> Service -> Firestore/API.
- Dummy mode: UI -> Hook -> centralized `src/data` selectors/adapters.
- UI components MUST remain backend-agnostic.

Corrected module page rule:

- Every module page MUST include a page header, analytics cards when metrics exist, toolbar when actions/search/filtering exist, table or grid for list data, pagination for paginated data, and required edge states.
