# 🧠 AI AGENT PROMPT — ROLES & RBAC SYSTEM

## 🧩 ROLE DEFINITION

You are an expert Backend Architect, working for me as a senior engineer responsible for designing a secure and scalable Role-Based Access Control (RBAC) system.

Your job: Implement a centralized roles system and enforce permissions across the entire application.

---

## 🎯 GOAL

Create a system that:

- Defines roles clearly
- Controls access to modules and actions
- Is reusable across UI, middleware, and services

---

## 📦 CONTEXT

System:

- Hotel Management Dashboard

Roles:

- admin
- accountant
- front_desk

Modules:

- users
- contacts
- reservations
- accounting

---

## ⚠️ CONSTRAINTS

- MUST centralize roles in one place
- MUST NOT hardcode roles inside components
- MUST be reusable across:
  - middleware
  - UI
  - services

- MUST follow clean architecture

---

## 🧠 BEFORE YOU START

1. Restate the task
2. Ask 3–5 questions
3. Provide plan

---

# 🚀 IMPLEMENTATION STEPS

---

## STEP 1 — DEFINE ROLES

Create:

src/config/roles.ts

Define:

```ts
export const ROLES = {
  ADMIN: "admin",
  ACCOUNTANT: "accountant",
  FRONT_DESK: "front_desk",
};
```

---

## STEP 2 — DEFINE PERMISSIONS

Create:

```ts
permissions.ts;
```

Structure:

```ts
export const PERMISSIONS = {
  users: ["admin"],
  accounting: ["admin", "accountant"],
  reservations: ["admin", "accountant", "front_desk"],
  contacts: ["admin", "front_desk"],
};
```

---

## STEP 3 — ACCESS HELPERS

Create functions:

- canAccessModule(role, module)
- canPerformAction(role, action)

---

## STEP 4 — UI INTEGRATION

Use:

- hide buttons based on role
- disable restricted actions

---

## STEP 5 — MIDDLEWARE INTEGRATION

- Protect routes using role
- Redirect unauthorized users

---

## STEP 6 — SERVICE-LEVEL SECURITY

- Validate role before critical actions
- NEVER trust UI

---

## STEP 7 — FUTURE SCALABILITY

Design system so you can:

- Add roles easily
- Add permissions easily

---

# 🔒 VALIDATION

Ensure:

- No hardcoded roles in UI
- Central config used everywhere
- Middleware enforces rules
- Services validate permissions

---

# 🧾 OUTPUT EXPECTED

- roles.ts
- permissions.ts
- helper functions
- integration examples

Stop after implementation.
