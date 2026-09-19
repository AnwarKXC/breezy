# 🧠 AI AGENT PROMPT — USER DETAILS PAGE (DYNAMIC ROUTE + HISTORY)

## 🧩 ROLE DEFINITION

You are an expert Full-Stack Engineer, working for me as a senior developer responsible for implementing dynamic routing and data fetching for user details.

Your job: Create a user details page that loads user data and their reservation history.

---

## 🎯 GOAL

Implement:

- Clickable users
- Dynamic route: /users/[id]
- Fetch user data from Firestore
- Fetch reservation history for that user
- Display analytics + tables

---

## 📦 CONTEXT

System:

- Hotel Management Dashboard

Stack:

- Next.js App Router
- Firebase (Firestore)
- Redux Toolkit

Collections:

- users
- reservations

---

## ⚠️ CONSTRAINTS

- MUST NOT pass full user data via route
- MUST fetch data using ID
- MUST follow architecture (UI → Hook → RTK → Service)
- MUST use pagination for reservations
- MUST support i18n

---

## 🧠 BEFORE YOU START

1. Restate task
2. Ask 3–5 questions
3. Provide plan

---

# 🚀 IMPLEMENTATION STEPS

---

## STEP 1 — DYNAMIC ROUTE

Create:

src/app/(dashboard)/users/[id]/page.tsx

---

## STEP 2 — CLICKABLE USERS

In users table:

- Wrap row or button with:

```ts
router.push(`/users/${user.id}`);
```

---

## STEP 3 — USER SERVICE

Add:

- getUserById(id)

---

## STEP 4 — RESERVATIONS SERVICE

Add:

- getReservationsByUser(userId)

Firestore query:

- where("userId", "==", id)

---

## STEP 5 — HOOK

Create:

useUserDetails()

Responsibilities:

- fetch user
- fetch reservations
- manage loading & errors

---

## STEP 6 — UI STRUCTURE

Page layout:

### Top Section (Cards):

- Total reservations
- Total revenue
- Last booking date

---

### User Info Section:

- name
- email
- phone
- role

---

### Reservations Table:

- list reservations
- pagination
- status
- dates
- total price

---

## STEP 7 — ANALYTICS CARDS

Add:

- total bookings
- total spent
- average stay

---

## STEP 8 — LOADING STATE

- skeleton loader

---

## STEP 9 — ERROR HANDLING

- show fallback UI

---

## STEP 10 — PERFORMANCE

- do not fetch all reservations at once
- use pagination

---

## STEP 11 — RBAC

Ensure:

- only authorized roles can view user details

---

## STEP 12 — LOGGING

Log:

- "VIEW_USER_DETAILS"

---

## STEP 13 — ROUTING BACK

Add:

- back button to users list

---

# 🔒 VALIDATION

Ensure:

- clicking user opens correct page
- data loads correctly
- refresh works (no lost data)
- reservations linked correctly

---

# 🧾 OUTPUT EXPECTED

- dynamic route page
- services
- hook
- UI (cards + table)
- navigation working

Stop after implementation.
