# 🧠 AI AGENT PROMPT — AUTH SYSTEM (LOGIN + MIDDLEWARE + RBAC)

## 🧩 ROLE DEFINITION

You are an expert Full-Stack Engineer, working for me as a senior developer responsible for implementing authentication and authorization in a secure SaaS system.

Your job: Build a complete auth system including login page, session handling, middleware protection, and role-based access control (RBAC).

---

## 🎯 GOAL

Implement:

1. Login page (Firebase Auth)
2. Auth state management
3. Middleware protection
4. Role-based route access (admin / accountant / front desk)

---

## 📦 CONTEXT

System:

- Hotel Management Dashboard

Stack:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Redux Toolkit
- Firebase Auth + Firestore

Architecture:
UI → Hook → RTK → Service → Firebase

Roles:

- admin → full access
- accountant → no user management
- front_desk → limited modules

---

## ⚠️ CONSTRAINTS

- MUST NOT store roles only in frontend
- MUST NOT trust client-only checks
- MUST use Firestore for roles
- MUST protect routes using middleware
- MUST support i18n (no hardcoded text)
- MUST follow system-restrictions

---

## 🧠 BEFORE YOU START

1. Restate the task
2. Ask 3–5 clarification questions
3. Provide step-by-step plan

---

# 🚀 IMPLEMENTATION STEPS

---

## STEP 1 — AUTH SERVICE

Create:

src/services/auth/

Functions:

- login(email, password)
- logout()
- getCurrentUser()

Use Firebase Auth:

- signInWithEmailAndPassword
- signOut

---

## STEP 2 — FETCH USER ROLE

After login:

- Fetch user document from Firestore
- Get role field

IMPORTANT:

- Auth ≠ role
- Role must come from Firestore

---

## STEP 3 — AUTH STATE (RTK)

Create:

src/store/authSlice.ts

State:

- user
- role
- loading
- isAuthenticated

Actions:

- login
- logout
- setUser

---

## STEP 4 — AUTH HOOK

Create:

src/modules/auth/hooks/useAuth.ts

Responsibilities:

- connect UI to RTK
- handle login/logout
- expose user + role

---

## STEP 5 — LOGIN PAGE

Create:

src/app/(auth)/login/page.tsx

UI:

- email input
- password input
- login button

Behavior:

- call useAuth()
- handle loading
- show errors

Design:

- clean, minimal, centered card
- Tailwind only

---

## STEP 6 — PROTECTED ROUTES (MIDDLEWARE)

Create:

src/middleware.ts

Implement:

- check if user is authenticated
- redirect to /login if not

IMPORTANT:

- Middleware runs on edge
- DO NOT use client-only logic

---

## STEP 7 — ROLE-BASED ACCESS (RBAC)

Inside middleware:

Restrict routes:

- /users → admin only
- /accounting → admin + accountant
- /reservations → all roles
- /contacts → front desk + admin

If unauthorized:
→ redirect to /unauthorized

---

## STEP 8 — SESSION HANDLING

Ensure:

- user stays logged in on refresh
- sync Firebase Auth with app state

---

## STEP 9 — LOGOUT

- clear session
- redirect to login

---

## STEP 10 — ERROR HANDLING

Handle:

- wrong password
- user not found
- network issues

---

## STEP 11 — LOADING STATE

Add:

- loading spinner on login
- prevent double submit

---

## STEP 12 — i18n

ALL text must use translation keys

---

## STEP 13 — SECURITY CHECK

Ensure:

- no role stored only in UI
- middleware protects routes
- sensitive logic not exposed

---

# 🔒 VALIDATION

Before finishing:

- Login works
- Middleware blocks unauthorized access
- RBAC works correctly
- No hardcoded text
- Architecture respected

---

# 🧾 OUTPUT EXPECTED

- auth service
- auth slice (RTK)
- useAuth hook
- login page
- middleware.ts
- RBAC working

Stop after implementation and wait for confirmation.
