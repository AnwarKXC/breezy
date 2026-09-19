# FIREBASE_TO_SUPABASE_CODEX_MASTER_PROMPT.md

You are Codex acting as a senior full-stack migration engineer.

Goal: migrate this entire project from Firebase to Supabase safely, step by step.

Important:

- Use Supabase MCP whenever you need Supabase project info, schema info, docs, migrations, SQL, auth, storage, edge functions, or policies.
- Do not guess Supabase details. Query MCP first.
- Do not make large unreviewed changes.
- Work in small phases.
- After each phase, run tests/typecheck/lint when available.
- Never expose Supabase service role keys in client code.
- Preserve existing app behavior.

## Phase 0 — Verify MCP

First verify Supabase MCP is available.

Use the Supabase MCP server to:

1. confirm connection
2. list accessible Supabase projects
3. identify the target project
4. inspect existing database schemas, tables, policies, buckets, and auth settings

If MCP is unavailable, stop and tell me the exact setup issue.

## Phase 1 — Audit Firebase

Inspect the full repository.

Find every Firebase usage:

- firebase/app
- firebase/auth
- firebase/firestore
- firebase/storage
- firebase/functions
- firebase-admin
- Firestore rules
- Storage rules
- Firebase config files
- Firebase env vars
- custom Firebase wrappers
- tests/mocks using Firebase

Create a report with:

1. file path
2. Firebase feature used
3. current behavior
4. Supabase equivalent
5. migration risk
6. required schema/table/bucket/policy/function

Do not edit files yet.

## Phase 2 — Migration Plan

Create a detailed migration plan.

Include:

- Supabase tables needed
- SQL migrations needed
- RLS policies
- indexes
- storage buckets
- storage policies
- auth provider changes
- realtime subscriptions
- edge functions or server routes
- env vars to add/remove
- files to modify
- test checklist

Use Supabase MCP to validate current project state before writing the plan.

Stop after the plan and wait for approval.

## Phase 3 — Schema and RLS

After approval, create Supabase SQL migrations.

For every Firestore collection:

- design relational Postgres tables
- use UUID primary keys unless existing IDs must be preserved
- add user_id foreign keys where needed
- add created_at and updated_at
- add indexes for existing query patterns
- convert nested Firestore objects to either relational tables or jsonb
- create RLS policies for select/insert/update/delete

Use Supabase MCP to apply or prepare migrations.

After migrations:

- inspect schema with MCP
- verify tables exist
- verify RLS is enabled
- verify policies exist

## Phase 4 — Supabase Client Setup

Replace Firebase initialization with Supabase.

Tasks:

- install @supabase/supabase-js if missing
- create a single Supabase browser/client helper
- create server/service helper only if needed
- add env vars:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY only server-side if needed
- remove Firebase initialization from runtime code

Do not remove Firebase package yet until all usage is gone.

## Phase 5 — Auth Migration

Replace Firebase Auth with Supabase Auth.

Map:

- onAuthStateChanged → supabase.auth.onAuthStateChange
- currentUser → supabase.auth.getUser / getSession
- signInWithEmailAndPassword → supabase.auth.signInWithPassword
- createUserWithEmailAndPassword → supabase.auth.signUp
- signOut → supabase.auth.signOut
- sendPasswordResetEmail → supabase.auth.resetPasswordForEmail
- updateProfile → user metadata update
- Google/GitHub/etc providers → supabase.auth.signInWithOAuth

Preserve:

- protected routes
- redirects
- session persistence
- user profile behavior
- role/admin checks

Use MCP if Supabase Auth configuration or docs are needed.

## Phase 6 — Database Queries

Replace Firestore with Supabase queries.

Map:

- collection/doc/getDoc/getDocs → from(...).select()
- addDoc → insert()
- setDoc → upsert()
- updateDoc → update()
- deleteDoc → delete()
- where → eq/neq/lt/lte/gt/gte/in/contains
- orderBy → order()
- limit → limit()
- startAfter/pagination → range() or cursor strategy
- onSnapshot → Supabase Realtime subscription only when needed
- serverTimestamp → database default now()

For each changed file:

- keep behavior identical
- remove unused Firebase imports
- handle loading/error states
- add type-safe Supabase response handling

Use MCP to inspect table names, columns, and policies before writing queries.

## Phase 7 — Storage

Replace Firebase Storage with Supabase Storage.

Map:

- ref → bucket path
- uploadBytes/uploadString → storage.from(bucket).upload()
- getDownloadURL → getPublicUrl() or createSignedUrl()
- deleteObject → remove()
- listAll → list()

Use MCP to:

- verify buckets
- create missing buckets
- create storage policies

Preserve:

- file paths
- permissions
- public/private access behavior
- upload validation
- URL storage format

## Phase 8 — Functions/Admin

Replace Firebase Functions and firebase-admin.

For each usage, decide:

- Supabase Edge Function
- Postgres function/trigger
- server API route
- cron job
- direct Supabase query

Rules:

- service role key only on server
- validate Supabase JWTs
- preserve admin-only behavior
- use RLS where possible
- avoid bypassing RLS unless required

Use MCP for Edge Function, SQL, and policy context.

## Phase 9 — Data Migration Scripts

Create migration scripts if needed.

Scripts should:

- export Firebase users/data/files
- transform Firestore documents into Supabase rows
- preserve IDs where required
- preserve user ownership
- handle nested data
- be idempotent where possible
- log skipped/failed records
- never commit secrets

Create:

- scripts/migrate-firebase-to-supabase/
- README with exact run commands
- dry-run option if possible

## Phase 10 — Cleanup

When all Firebase usage is gone:

- uninstall firebase packages
- remove Firebase config
- remove Firebase env vars
- remove unused Firebase rules/deploy files if no longer needed
- update README
- update .env.example
- search the repo for:
  - firebase
  - firestore
  - firebase-admin
  - getDoc
  - collection(
  - onSnapshot
  - uploadBytes
  - getDownloadURL

No Firebase runtime imports should remain.

## Phase 11 — Verification

Run:

- install/build command
- typecheck
- lint
- tests
- app-specific smoke tests

Then verify manually:

- sign up
- sign in
- sign out
- protected routes
- profile/user data
- CRUD flows
- realtime flows
- file upload/download/delete
- admin/server-only flows
- RLS access denial for unauthorized users

Use Supabase MCP to inspect logs, schema, policies, and project state when useful.

## Output Format After Each Phase

Return:

1. what changed
2. files changed
3. MCP checks performed
4. commands run
5. test results
6. risks or TODOs
7. next recommended phase

Start now with Phase 0 only.
