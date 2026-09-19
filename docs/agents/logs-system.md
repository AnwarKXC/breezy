# 🧠 AI AGENT PROMPT — LOGS SYSTEM (AUDIT TRAIL)

## 🧩 ROLE DEFINITION

You are an expert Backend Architect, working for me as a senior engineer responsible for implementing a scalable and secure logging (audit trail) system.

Your job: Build a centralized logs system that tracks all important actions across the application.

---

## 🎯 GOAL

Create a logs system that:

- Tracks user actions (CRUD, auth, etc.)
- Is centralized and reusable
- Works across all modules
- Supports future analytics & reports

---

## 📦 CONTEXT

System:

- Hotel Management Dashboard

Stack:

- Next.js (App Router)
- TypeScript
- Firebase (Firestore)
- Redux Toolkit

Architecture:
UI → Hook → RTK → Service → Firebase

Modules:

- users
- contacts
- reservations
- accounting

---

## ⚠️ CONSTRAINTS

- MUST log ONLY from service layer (NOT UI)
- MUST keep logs structured
- MUST be reusable across modules
- MUST include timestamps
- MUST follow system-restrictions
- MUST NOT over-fetch logs (pagination required)

---

## 🧠 BEFORE YOU START

1. Restate the task
2. Ask 3–5 clarification questions
3. Provide step-by-step plan

---

# 🚀 IMPLEMENTATION STEPS

---

## STEP 1 — CREATE COLLECTION STRUCTURE

Firestore collection:

logs

Document structure:

```ts id="a9d2kl"
{
  id: string
  userId: string
  userName: string
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT"
  module: "users" | "contacts" | "reservations" | "accounting"
  entityId: string
  entityType: string
  description: string
  metadata?: {
    before?: any
    after?: any
  }
  createdAt: Timestamp
}
```

---

## STEP 2 — LOG SERVICE

Create:

src/services/logs/logService.ts

Functions:

- createLog(logData)
- getLogs(filters)
- getLogsByUser(userId)

---

## STEP 3 — CREATE LOG HELPER

Create reusable helper:

logAction()

Usage:

```ts id="u3l2xs"
logAction({
  action: "CREATE",
  module: "users",
  entityId: user.id,
  description: "Admin created new user",
});
```

---

## STEP 4 — INTEGRATE WITH MODULES

Add logging to:

### Users:

- create user → log CREATE
- update user → log UPDATE
- delete user → log DELETE

### Auth:

- login → log LOGIN
- logout → log LOGOUT

---

## STEP 5 — FETCH LOGS (WITH PAGINATION)

Ensure:

- limit results
- sort by createdAt (desc)

---

## STEP 6 — LOGS MODULE UI

Create:

src/app/(dashboard)/logs/page.tsx

Features:

- Table view (rows)
- Optional grid view
- Pagination
- Filters:
  - by user
  - by module
  - by action

---

## STEP 7 — ANALYTICS CARDS (TOP)

Add cards:

- Total actions today
- Most active user
- Most used module

---

## STEP 8 — EXPORT FEATURE

Add:

- Export CSV (raw data)
- Export PDF (formatted report)

---

## STEP 9 — PERFORMANCE

Ensure:

- Do not fetch all logs at once
- Use pagination
- Use Firestore queries

---

## STEP 10 — SECURITY

Ensure:

- Only admin can access logs page
- Do not expose sensitive metadata

---

## STEP 11 — CLEAN STRUCTURE

```bash id="t7d8sq"
modules/logs/
  hooks/
  components/
  services/
```

---

# 🔒 VALIDATION

Ensure:

- Logs are created for all actions
- Logs are not created from UI
- Logs page loads fast
- Pagination works
- Filters work
- Only admin can access logs

---

# 🧾 OUTPUT EXPECTED

- logs collection usage
- logService
- logAction helper
- logs page (UI)
- analytics cards
- export functionality

Stop after implementation.
