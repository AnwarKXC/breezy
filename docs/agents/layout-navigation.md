# 🧠 AI AGENT PROMPT — DASHBOARD LAYOUT & NAVIGATION SYSTEM

## 🧩 ROLE DEFINITION

You are an expert Frontend Architect & UI Engineer, working for me as a senior developer responsible for implementing a scalable dashboard layout and navigation system.

Your job: Build a global layout with sidebar navigation, top navbar, and shared UI elements across all pages.

---

## 🎯 GOAL

Implement:

1. Sidebar with working navigation to modules
2. Global navbar (shared across all pages)
3. Notifications icon (visible everywhere)
4. Profile icon with dropdown menu
5. Clean, scalable layout structure

---

## 📦 CONTEXT

System:

- Hotel Management Dashboard

Modules:

- users
- contacts
- reservations
- accounting

Stack:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Redux Toolkit

Architecture:
UI → Hook → RTK → Service

---

## ⚠️ CONSTRAINTS

- MUST use App Router layout system
- MUST NOT duplicate navbar in pages
- MUST use reusable components
- MUST support i18n (no hardcoded text)
- MUST support RTL (Arabic)
- MUST follow system-restrictions
- MUST keep components under size limits

---

## 🧠 BEFORE YOU START

1. Restate the task
2. Ask 3–5 questions
3. Provide step-by-step plan

---

# 🚀 IMPLEMENTATION STEPS

---

## STEP 1 — GLOBAL DASHBOARD LAYOUT

Create:

```bash
src/app/(dashboard)/layout.tsx
```

Layout structure:

- Sidebar (left)
- Main content
- Top Navbar

Ensure:

- Layout wraps ALL dashboard pages
- No duplication across pages

---

## STEP 2 — SIDEBAR COMPONENT

Create:

```bash
src/components/layout/sidebar.tsx
```

Sidebar must include links:

- /users
- /contacts
- /reservations
- /accounting

Use:

- icons
- active state styling
- collapsible (optional)

---

## STEP 3 — NAVIGATION (ROUTING)

Use:

- Next.js `Link`
- OR `useRouter`

Ensure:

- Clicking sidebar item redirects correctly
- Active route is highlighted

---

## STEP 4 — NAVBAR COMPONENT

Create:

```bash
src/components/layout/navbar.tsx
```

Navbar must include:

- Page title (dynamic)
- Notifications icon 🔔
- Profile icon 👤

---

## STEP 5 — GLOBAL NAVBAR USAGE

Add navbar inside:

```bash
layout.tsx
```

Ensure:

- Appears on ALL dashboard pages
- Not repeated manually

---

## STEP 6 — NOTIFICATIONS ICON

Add icon:

- top right of navbar

Behavior:

- clickable
- placeholder dropdown (for now)

---

## STEP 7 — PROFILE DROPDOWN

Create dropdown:

Options:

- View Profile
- Settings (optional)
- Logout

Behavior:

- toggle on click
- close on outside click

---

## STEP 8 — LOGOUT ACTION

Connect:

- logout button → auth hook

Ensure:

- clears session
- redirects to /login

---

## STEP 9 — RESPONSIVE DESIGN

Ensure:

- Sidebar collapses on small screens
- Navbar stays fixed

---

## STEP 10 — RTL & LANGUAGE SWITCH SUPPORT

Ensure full internationalization (i18n) support for English (LTR) and Arabic (RTL).

### Requirements:

1. Add a language switch button in the navbar:
   - Toggle between: EN / AR
   - Place it near profile or notifications
   - Persist selected language (localStorage or cookie)

2. Layout behavior:
   - When Arabic is active:
     - Enable RTL (`dir="rtl"`)
     - Sidebar moves to the right
     - Navbar alignment flips
   - When English is active:
     - Use LTR (`dir="ltr"`)

3. Implementation:

- Create language config:
  src/config/i18n.ts

- Store current language globally (RTK or context)

- Apply direction dynamically:
  <html dir="ltr | rtl">

4. Translations:

- Use translation keys (no hardcoded text)
- Example:
  t("users.title")

5. Performance:

- Lazy load language files
- Avoid full re-render if possible

6. UI Behavior:

- Smooth transition when switching language
- Maintain current route after switching

---

### Validation:

- Switching language updates UI instantly
- Layout flips correctly (sidebar + navbar)
- No hardcoded text remains
- Works across ALL pages

---

## STEP 11 — ACCESS CONTROL (RBAC READY)

Prepare:

- Hide sidebar links based on role

Example:

- users → admin only
- accounting → admin + accountant

---

## STEP 12 — CLEAN STRUCTURE

Final structure:

```bash
components/
  layout/
    sidebar.tsx
    navbar.tsx
```

---

# 🔒 VALIDATION

Ensure:

- Navigation works correctly
- Navbar visible everywhere
- Profile dropdown works
- Logout works
- No duplicated layout code

---

# 🧾 OUTPUT EXPECTED

- dashboard layout
- sidebar component
- navbar component
- working navigation
- profile dropdown

Stop after implementation.
