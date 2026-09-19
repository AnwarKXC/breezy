# 🧠 AI AGENT PROMPT — USERS MODULE (FIREBASE + RBAC)

## 🧩 ROLE DEFINITION

You are an expert Full-Stack Engineer, working for me as a senior developer responsible for building the Users Module in a scalable SaaS system.

Your job: Implement a complete Users Module using Firebase Authentication + Firestore, including roles, permissions, UI, and integration with the system architecture.

---

## 🎯 GOAL

Build a full Users Module that allows:

- Admin to create staff accounts
- Assign roles (admin / accountant / front desk)
- Manage users (CRUD)
- Track activity logs
- Enforce role-based access control (RBAC)

---

## 📦 CONTEXT

System:

- Hotel Management System
- Staff-only dashboard

Stack:

- Next.js App Router
- TypeScript
- Tailwind
- Redux Toolkit
- Firebase Auth + Firestore
- PWA enabled
- i18n (EN + AR, RTL)

Architecture:

- Modular structure
- Shared UI system (table + analytics)

---

## ⚠️ CONSTRAINTS

- MUST follow system-restrictions.md
- MUST use RTK (NOT Zustand)
- MUST follow:
  UI → Hook → RTK → Service → Firebase
- MUST NOT put business logic in UI
- MUST support i18n (NO hardcoded text)
- MUST enforce RBAC securely (not UI only)

---

## 🧠 BEFORE YOU START

1. Restate the task
2. Ask 3–5 clarification questions
3. Propose implementation plan

DO NOT write code yet.

---

# 🚀 IMPLEMENTATION STEPS

---

## STEP 1 — FIREBASE SETUP

### Tasks:

- Initialize Firebase client SDK
- Initialize Firebase Admin SDK (server-side)

IMPORTANT:

- Client SDK → browser
- Admin SDK → server (secure)

👉 Firebase uses separate auth & authorization systems, so roles must be stored manually (Firestore or custom claims) ([Stack Overflow][1])

---

## STEP 2 — USER DATA MODEL

Create Firestore collection:

```ts
users/
{
  id: string
  name: string
  email: string
  role: "admin" | "accountant" | "front_desk"
  phone: string
  createdAt: timestamp
}
```

---

## STEP 3 — ROLES SYSTEM (RBAC)

Create:

```ts
roles.ts;
```

Rules:

- admin → full access
- accountant → no user CRUD
- front desk → limited modules

Best practice:

- Centralize roles in one file
- Default = lowest privilege ([Next.js Launchpad][2])

---

## STEP 4 — AUTHENTICATION

Implement:

- Create user (admin only)
- Login
- Logout
- Change password

Use:

- Firebase Auth (email + password)

---

## STEP 5 — AUTHORIZATION (CRITICAL)

Implement:

- Server-side role validation
- Protect routes
- Protect actions

IMPORTANT:

- NEVER trust frontend checks only
- Always validate on server ([Next.js][3])

---

## STEP 6 — SERVICES LAYER

Create:

```
modules/users/services/
```

Functions:

- createUser()
- getUsers()
- updateUser()
- deleteUser()

These must:

- interact with Firebase
- NOT be used directly in UI

---

## STEP 7 — REDUX TOOLKIT

Create slice:

```
modules/users/store/usersSlice.ts
```

State:

- users list
- loading
- error

Async actions:

- fetchUsers
- createUser
- updateUser
- deleteUser

---

## STEP 8 — HOOKS

Create:

```
modules/users/hooks/
```

Example:

- useUsers()
- useCreateUser()

Hooks connect:
UI → RTK

---

## STEP 9 — UI IMPLEMENTATION

Follow UI system:

### Page MUST include:

1. Analytics cards:
   - total users
   - users by role

2. Toolbar:
   - search
   - filters (role)

3. Table:
   - row view
   - grid view

---

## STEP 10 — USER FORM

Create form for:

- create user
- edit user

Fields:

- name
- email
- phone
- role

---

## STEP 11 — ACTIVITY LOGS

Log:

- user created
- user updated
- user deleted

Store in:

```
logs collection
```

---

## STEP 12 — i18n

ALL labels must use:

- translation keys

NO hardcoded text

---

## STEP 13 — SECURITY CHECK

Ensure:

- Only admin can create users
- Accountant cannot edit users
- Front desk cannot access users module

---

## STEP 14 — EXPORT FEATURE

Add:

- Export users table (CSV / PDF)

---

# 🔒 VALIDATION

Before finishing:

- RBAC works correctly
- No direct Firebase calls in UI
- Data flow correct
- No hardcoded text
- File size limits respected

---

# 🧾 OUTPUT EXPECTED

- Firebase setup
- Users module structure
- RTK slice
- Hooks
- UI (cards + table + form)
- RBAC enforcement

Stop after each step and confirm.
