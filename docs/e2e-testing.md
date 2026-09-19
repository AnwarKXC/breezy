# E2E Testing Guide

## Overview

This project uses **Playwright** for end-to-end testing. Tests simulate real user interactions with the hotel management system, covering authentication, admin dashboard operations, authorization, validation, and mobile responsiveness.

## Prerequisites

- Node.js 18+
- The app must be running locally (or on a staging server)
- A Supabase project with test data (see seeding section)
- `.env.test` file with valid credentials

## Setup

### 1. Environment File

Copy the example env file and fill in your test values:

```bash
cp .env.test.example .env.test
```

**Required variables:**

| Variable | Description |
|----------|-------------|
| `E2E_BASE_URL` | URL where the app is running (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for seed scripts |
| `TEST_GUEST_EMAIL` / `TEST_GUEST_PASSWORD` | Guest account credentials |
| `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` | Admin account credentials |
| `TEST_FRONT_DESK_EMAIL` / `TEST_FRONT_DESK_PASSWORD` | Front desk account credentials |
| `TEST_ACCOUNTANT_EMAIL` / `TEST_ACCOUNTANT_PASSWORD` | Accountant account credentials |

**⚠️ SAFETY: Never commit `.env.test` with real secrets. Always use `.env.test.example` for the template.**

### 2. Start the App

```bash
npm run dev
```

The app should be running at `http://localhost:3000`.

### 3. Test Data

Test accounts must exist in the Supabase project's `auth.users` table with corresponding entries in the `profiles` table.

#### Creating Test Accounts (via Supabase Dashboard)

1. Go to your Supabase project → Authentication → Users
2. Add users with the emails specified in `.env.test`
3. Go to SQL Editor and insert corresponding profile rows:
   ```sql
   INSERT INTO public.profiles (id, name, email, role)
   VALUES
     ('<auth-user-id>', 'Test Admin', 'admin@hotel.test', 'admin'),
     ('<auth-user-id>', 'Test Front Desk', 'frontdesk@hotel.test', 'front_desk'),
     ('<auth-user-id>', 'Test Accountant', 'accountant@hotel.test', 'accountant');
   ```

#### Test Data Template

For room types, rooms, and booking test data, use the Supabase SQL Editor:

```sql
-- Sample room types (seeded by migration 8, but re-run if needed)
INSERT INTO public.room_types (name, slug, description, base_price, default_capacity)
VALUES
  ('Standard', 'standard', 'Standard room', 100.00, 2),
  ('Deluxe', 'deluxe', 'Deluxe room', 180.00, 2),
  ('Suite', 'suite', 'Suite', 350.00, 4),
  ('Family', 'family', 'Family room', 250.00, 4)
ON CONFLICT (slug) WHERE deleted_at IS NULL DO NOTHING;

-- Sample rooms
INSERT INTO public.rooms (number, floor, status, price, capacity, room_type_id)
SELECT '101', 1, 'available', 100.00, 2, id FROM public.room_types WHERE slug = 'standard';
```

## Running Tests

### Run all E2E tests (headless)

```bash
npm run test:e2e
```

### Run tests with UI mode

```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)

```bash
npm run test:e2e:headed
```

### Run tests and generate QA report

```bash
npm run test:e2e:qa
```

### View Playwright HTML report

```bash
npm run test:e2e:report
```

## Test Structure

```
e2e/
├── helpers/
│   ├── auth.ts          # Login/logout helpers + utilities
│   ├── test-data.ts     # Route constants and test data helpers
│   └── selectors.ts     # Centralised accessible selectors
├── auth.spec.ts         # Authentication flow tests
├── admin.spec.ts        # Admin dashboard page tests
├── authorization.spec.ts # Role-based access control tests
├── validation.spec.ts   # Form validation tests
├── mobile.spec.ts       # Mobile viewport tests
└── guest-booking.spec.ts # Placeholder for future guest booking tests
```

## Writing Tests

### Best Practices

1. **Use accessible selectors** — prefer `getByRole`, `getByLabel`, `getByPlaceholder`
2. **Avoid brittle CSS selectors** — use `data-testid` only when no accessible alternative exists
3. **Test isolation** — each test should work independently
4. **Clean up** — log out after tests that log in
5. **Use environment variables** — never hardcode credentials or URLs
6. **Wait for network idle** — use `page.waitForLoadState('networkidle')` after navigation

### Helper Functions

```typescript
// e2e/helpers/auth.ts
loginAs(page, email, password)
loginAsAdmin(page)
loginAsFrontDesk(page)
loginAsAccountant(page)
logout(page)
generateUniqueTestEmail()
```

### Adding a New Test File

1. Create the spec file under `e2e/`
2. Import helpers from `./helpers/`
3. Use `test.describe` to group related tests
4. Run `npm run test:e2e` to verify

## QA Report

After running `npm run test:e2e:qa`, a Markdown report is generated at:

```
reports/e2e-report.md
```

The report includes:
- Test summary (pass/fail/skip counts)
- Failed test details with severity
- Skipped test documentation
- Manual QA checklist
- Accessibility and security notes
- Recommended next actions

## CI Integration

Add to your CI pipeline (e.g., GitHub Actions):

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright
  run: npx playwright install chromium

- name: Run E2E tests
  run: npm run test:e2e
  env:
    E2E_BASE_URL: ${{ vars.E2E_BASE_URL }}
    # ... other env vars
```

## Safety Rules

- **Never test against production.** Always use a staging or local Supabase project.
- **Never commit real credentials.** Use `.env.test.example` for templates.
- **Never use the service role key in browser tests.** It is server-only.
- **Isolate test data.** Create dedicated test accounts and data.
- **Reset test data between runs.** Use the Supabase dashboard SQL editor or a seed script.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tests timeout | Ensure the app is running at `E2E_BASE_URL` |
| Login fails | Verify test accounts exist in Supabase Auth + profiles table |
| Selectors not found | Check if the page has accessible labels; add `data-testid` if needed |
| Report file missing | Run `npm run test:e2e:qa` which generates both results and report |
| Playwright not found | Run `npx playwright install chromium` |
