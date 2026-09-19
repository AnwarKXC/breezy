# Hotel Management System

A production-grade, full-stack hotel management application built with **Next.js 16**, **React 19**, **TypeScript**, **Redux Toolkit**, and **Supabase**. Features role-based access control, bilingual support (English/Arabic), PWA installability, and a strict layered architecture.

---
 
## Table of Contents

- [Tech Stack](#-tech-stack)
- [Architecture](#%EF%B8%8F-architecture)
- [Project Structure](#-project-structure)
- [Key Features](#-key-features)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [Internationalization (i18n)](#-internationalization-i18n)
- [PWA & Offline Support](#%EF%B8%8F-pwa--offline-support)
- [Development Conventions](#-development-conventions)
- [State Management](#-state-management)
- [Services Layer](#-services-layer)
- [Deployment](#-deployment)

---

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | Next.js 16.2.4 (App Router, RSC) |
| **UI Library** | React 19.2.4 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 + PostCSS |
| **State** | Redux Toolkit 2.11 + React Redux 9.2 |
| **Backend** | Supabase (Auth, Database, Admin SDK) |
| **Validation** | Zod 4.3.6 |
| **Animations** | AOS (Animate On Scroll) |
| **PDF Export** | jsPDF + jsPDF-autoTable |
| **Linting** | ESLint 9 |

---

## Architecture

This project follows a **strict layered architecture** with unidirectional data flow:

```
┌─────────────────────────────────────────────┐
│  UI Components (Presentation Layer)          │
│  Sidebar, Navbar, BottomNav, DataTables      │
│  → Render only. No business logic.            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Custom Hooks (Orchestration Layer)          │
│  useUsers, useLogs, useBookings, etc.        │
│  → Coordinate UI ↔ RTK ↔ Services            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  RTK Slices (State Management Layer)         │
│  authSlice, uiSlice, etc.                    │
│  → Client-side state, selectors, reducers    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Services (Business Logic Layer)             │
│  bookingService, roomService, auth/, logs/   │
│  → Data transformation, API orchestration    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Supabase / External APIs (Data Layer)        │
│  Supabase Auth, Database, Admin SDK          │
│  → Persistence, authentication, server ops   │
└─────────────────────────────────────────────┘
```

### Layer Rules

1. **UI Components** never call APIs directly
2. **Hooks** dispatch RTK actions and invoke services
3. **Services** own all data fetching, mutation, and transformation logic
4. **Supabase** is only imported within the `services/` layer
5. **Config** (`config/`) owns all permissions, roles, and navigation definitions

---

## Project Structure

```
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── [locale]/                 # i18n route group (/en, /ar)
│   │   │   ├── (auth)/               # Login route group
│   │   │   │   └── login/            # Sign-in page
│   │   │   ├── (dashboard)/          # Protected dashboard modules
│   │   │   │   ├── page.tsx          # Dashboard home (metrics, charts)
│   │   │   │   ├── users/            # Staff user management (CRUD, export)
│   │   │   │   ├── contacts/         # Guest & contact management
│   │   │   │   ├── reservations/     # Booking & reservation management
│   │   │   │   ├── accounting/       # Financial transactions & reports
│   │   │   │   ├── logs/             # System audit trail (filter, export)
│   │   │   │   └── settings/         # Application settings
│   │   │   ├── unauthorized/         # 403 — access denied page
│   │   │   └── layout.tsx            # Locale layout (RTL support)
│   │   ├── api/                      # Server-side API routes
│   │   ├── sw/                       # Service worker registration
│   │   ├── offline/                  # PWA offline fallback page
│   │   ├── manifest.ts               # Web app manifest generator
│   │   ├── layout.tsx                # Root layout (Redux + i18n + PWA)
│   │   └── page.tsx                  # Root redirect
│   │
│   ├── components/
│   │   ├── AOSInit.tsx               # Animate On Scroll initializer
│   │   └── layout/
│   │       ├── BottomNav.tsx         # Mobile bottom tab bar (iOS safe-area)
│   │       ├── DashboardShell.tsx    # Responsive layout shell
│   │       ├── LayoutIcons.tsx       # SVG icon set for navigation
│   │       ├── Navbar.tsx            # Top header bar (search, profile, locale)
│   │       ├── NotificationsMenu.tsx # Notification dropdown
│   │       ├── ProfileMenu.tsx       # User profile & logout menu
│   │       ├── Sidebar.tsx           # Desktop collapsible sidebar
│   │       ├── SidebarNavLink.tsx    # Sidebar navigation link
│   │       └── TopbarActions.tsx     # Locale switcher, notifications
│   │
│   ├── config/                       # Configuration layer
│   │   ├── access.ts                 # Access control rule definitions
│   │   ├── actionPermissions.ts      # Action-level permission mapping
│   │   ├── navigation.ts             # Dashboard nav items & title keys
│   │   ├── permissions.ts            # Permission module constants
│   │   ├── rbac.ts                   # RBAC engine (role → module → action)
│   │   └── roles.ts                  # Role definitions (Admin, Accountant, FrontDesk)
│   │
│   ├── hooks/                        # Custom React hooks (orchestration)
│   │
│   ├── i18n/                         # Internationalization
│   │   ├── components/               # Translated UI components (LanguageSwitcher)
│   │   ├── hooks/                    # useTranslation hook
│   │   ├── locales/
│   │   │   ├── en.json               # English translations (254 keys)
│   │   │   └── ar.json               # Arabic translations (RTL)
│   │   ├── config.ts                 # Supported locales, default locale
│   │   └── provider.tsx              # React i18n context provider
│   │
│   ├── services/                     # Business logic services
│   │   ├── auth/                     # Auth operations
│   │   │   ├── authService.ts        # Sign-in, sign-out
│   │   │   ├── sessionService.ts     # Session management
│   │   │   ├── roleService.ts        # Role resolution
│   │   │   └── serverSession.ts      # Server-side session
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   ├── server.ts             # Server Supabase client
│   │   │   ├── admin.ts              # Service-role client
│   │   │   ├── proxy.ts              # SSR cookie refresh
│   │   │   └── database.types.ts     # Generated types
│   │   ├── logs/                     # Audit logging service
│   │   │   └── logService.ts         # CREATE, VIEW, log queries
│   │   ├── bookingService.ts         # Booking CRUD operations
│   │   ├── dashboardService.ts       # Dashboard metrics & stats
│   │   ├── guestService.ts           # Guest management
│   │   ├── roomService.ts            # Room management
│   │   └── index.ts
│   │
│   ├── store/                        # Redux state management
│   │   ├── authSlice.ts              # Auth state (user, session, role)
│   │   ├── slices/
│   │   │   └── uiSlice.ts            # UI state (sidebar, notifications)
│   │   ├── hooks.ts                  # Typed useAppSelector / useAppDispatch
│   │   ├── index.ts                  # Store configuration
│   │   └── provider.tsx              # Redux Provider wrapper
│   │
│   ├── types/                        # TypeScript type definitions
│   │   ├── auth.ts                   # Auth interfaces (User, Role, Session)
│   │   └── logs.ts                   # Log entry, action, module types
│   │
│   ├── shared/                       # Shared utilities & helpers
│   ├── modules/                      # Feature modules (AuthStateSync, etc.)
│   ├── proxy.ts                      # Middleware proxy configuration
│   ├── pwa/                          # PWA-specific configuration
│   ├── data/                         # Static data & seed data
│   └── styles/
│       └── globals.css               # Global styles, Tailwind, CSS variables
│
├── public/                           # Static assets (icons, manifest)
├── docs/                             # Project documentation
├── hooks/                            # Root-level hooks
├── services/                         # Root-level services
├── store/                            # Root-level store re-exports
├── components/                       # Root-level component re-exports
├── .env.local.example                # Environment variable template
├── next.config.ts                    # Next.js configuration
├── tsconfig.json                     # TypeScript configuration
├── eslint.config.mjs                 # ESLint configuration
├── postcss.config.mjs                # PostCSS configuration
└── package.json
```

---

## Key Features

| Feature | Description |
|---|---|
| **RBAC** | 3 roles (Admin, Accountant, Front Desk) with module-level and action-level permissions |
| **i18n** | English/Arabic with RTL layout support, locale-based routing (`/en`, `/ar`) |
| **PWA** | Installable, offline-capable, service worker, web manifest |
| **Responsive** | Desktop sidebar + mobile bottom tab bar with iOS safe-area handling |
| **Audit Logs** | Full system activity tracking with filtering and PDF/CSV export |
| **PDF Export** | jsPDF integration for Users, Logs, and other module data exports |
| **Supabase** | Email/password auth, PostgreSQL database, Admin SDK for server operations |
| **Animations** | AOS scroll animations for landing/dashboard transitions |
| **Validation** | Zod schema validation for forms and API payloads |

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **pnpm** (recommended) or npm/yarn
- **Supabase project** with Auth + Database enabled

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/abdo-hesham/Hotel-System.git
cd Hotel-System

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Available Scripts

```bash
pnpm dev      # Start development server
pnpm build    # Build for production
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

---

## Environment Variables

Create a `.env.local` file with the following variables:

### Supabase Client (exposed to browser)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key for browser and SSR clients |

### Supabase Admin (server-only)

| Variable | Description |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role key for admin operations |

> **Security Note:** Never commit `.env.local`. The `NEXT_PUBLIC_` prefix exposes values to the browser — these are safe (public config). `SUPABASE_SERVICE_ROLE_KEY` must **never** reach the client.

---

## Role-Based Access Control (RBAC)

### Roles

| Role | Dashboard | Users | Contacts | Reservations | Accounting | Logs |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Admin** | ✅ | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Accountant** | ✅ | ❌ | ✅ Full | ❌ | ✅ Full | ❌ |
| **Front Desk** | ✅ | 👁 View | ✅ Full | ✅ Full | ❌ | ❌ |

### How It Works

1. **Role Assignment**: Each user record in the database has a `role` field
2. **Permission Modules**: Defined in `config/permissions.ts` (USERS, CONTACTS, RESERVATIONS, ACCOUNTING, LOGS)
3. **Access Control**: `config/rbac.ts` maps roles → modules → allowed actions (VIEW, CREATE, UPDATE, DELETE)
4. **Route Protection**: Dashboard layout checks RBAC before rendering module pages
5. **Unauthorized Page**: Users without permission are redirected to `/[locale]/unauthorized`
6. **UI Gating**: Navigation items are filtered based on the user's role and module permissions

### Configuration Files

- `config/roles.ts` — Role enum and constants
- `config/permissions.ts` — Permission module definitions
- `config/rbac.ts` — Role-to-permission mapping engine
- `config/access.ts` — Access control rule helpers
- `config/actionPermissions.ts` — Granular action-level permissions

---

## Internationalization (i18n)

### Supported Locales

- **English** (`en`) — LTR layout
- **Arabic** (`ar`) — RTL layout

### Locale Routing

The app uses Next.js dynamic route segments for locale-based routing:

```
/en/dashboard        → English dashboard
/ar/dashboard        → Arabic dashboard
/en/users            → English users module
/ar/users            → Arabic users module
```

### Translation Keys

All user-facing text uses i18n keys via `useTranslation()` hook:

```typescript
import { useTranslation } from '@/i18n/hooks/useTranslation';

const { t, locale, dir, isRTL } = useTranslation();

// Usage in JSX
<h1>{t('dashboard.title')}</h1>
<p>{t('users.subtitle')}</p>
```

### Locale Files

| File | Keys | Purpose |
|------|------|---------|
| `src/i18n/locales/en.json` | 888 | Canonical English strings |
| `src/i18n/locales/ar.json` | 949 | Arabic translations (all en keys + module extras) |

Both files share the same nested-key structure. `ar.json` is synchronized from `en.json` — every English key has an Arabic counterpart.

### Adding New Strings

1. Add the key and English value to `en.json`
2. Add the same key with Arabic translation to `ar.json`
3. Run the sync script to validate structural parity:

```bash
node scripts/sync-ar-locale.mjs
```

For detailed translation guidelines, see [`CLAUDE_TRANSLATION.md`](CLAUDE_TRANSLATION.md).

### RTL Support

- Arabic locale automatically switches `dir="rtl"` on the HTML element
- Tailwind's logical properties (`ms-`, `me-`, `ps-`, `pe-`) handle spacing
- Sidebar and layout components adapt to RTL direction
- PDF generation uses `pdfmake` with Arabic font (`public/fonts/arabic.ttf`)
- Invoice PDFs localize all labels, currency formatting, and dates for Arabic

---

## PWA & Offline Support

### Features

- **Installable**: Add to home screen on mobile devices
- **Offline Page**: Custom fallback when network is unavailable
- **Service Worker**: Caches static assets for fast repeat visits
- **Web Manifest**: Configured icons, theme color, display mode

### Key Files

| File | Purpose |
|---|---|
| `src/app/manifest.ts` | Generates `manifest.json` dynamically |
| `src/app/sw/` | Service worker registration |
| `src/app/offline/` | Offline fallback page |
| `src/app/pwa-client.tsx` | Client-side PWA install prompt handler |

### iOS Safe Area

The mobile BottomNav component handles iOS safe areas:

```typescript
style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
```

---

## Development Conventions

### Architecture Rule

**Always follow**: `UI Component → Custom Hook → RTK Slice → Service → Supabase/API`

Never skip layers. UI components must not import Supabase or make API calls directly.

### i18n Rule

**All user-facing text** must use translation keys from `i18n/locales/*.json`. No hardcoded strings in components.

### Code Quality

- **No `console.log`** in production code
- **TypeScript strict mode** — no `as any`, `@ts-ignore`, or `@ts-expect-error`
- **ESLint** — run `pnpm lint` before committing
- **Zod validation** — validate all form inputs and API payloads

### Git Workflow

- Feature branches: `feat/<feature-name>`
- Commit messages: Conventional Commits format
- Never commit `.env.local` or sensitive credentials

---

## State Management

### Redux Toolkit Store

```
store/
├── index.ts              # Store configuration with combined reducers
├── authSlice.ts          # Auth state: user, role, session, loading
├── slices/
│   └── uiSlice.ts        # UI state: sidebar collapsed, notifications
├── hooks.ts              # Typed hooks: useAppSelector, useAppDispatch
└── provider.tsx          # Redux Provider wrapper
```

### Usage Pattern

```typescript
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectUser } from '@/store/authSlice';
import { toggleSidebar } from '@/store/slices/uiSlice';

const user = useAppSelector(selectUser);
const dispatch = useAppDispatch();

dispatch(toggleSidebar());
```

### Auth State Sync

`AuthStateSync` module (in root layout) syncs auth state with Redux store on app initialization, ensuring the UI always reflects the current authentication status.

---

## Services Layer

### Supabase Services (`services/supabase/`)

| File | Purpose |
|---|---|
| `client.ts` | Browser Supabase client using `@supabase/ssr` |
| `server.ts` | Server/route-handler Supabase client using Next.js cookies |
| `admin.ts` | Server-only service-role client |
| `proxy.ts` | Supabase SSR cookie refresh helper for the auth migration phase |
| `database.types.ts` | Generated schema types from the Phase 3 database |

### Feature Services

| Service | Purpose |
|---|---|
| `auth/` | Sign-in, sign-out, session management, role resolution |
| `logs/` | Audit log creation, querying, pagination |
| `bookingService.ts` | Booking CRUD, availability checks |
| `roomService.ts` | Room management, status updates |
| `guestService.ts` | Guest profile management |
| `dashboardService.ts` | Dashboard metrics, stats aggregation |

### Supabase Admin (`supabase/admin.ts`)

Server-only service-role client for privileged operations. **Never imported in client components.**

---

## Deployment

### Vercel (Recommended)

```bash
# 1. Connect your GitHub repo to Vercel
# 2. Set environment variables in Vercel dashboard
# 3. Deploy
vercel --prod
```

### Manual Build

```bash
pnpm build
pnpm start
```

### Docker (Optional)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["pnpm", "start"]
```

### Pre-Deployment Checklist

- [ ] All environment variables configured in deployment platform
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configured in deployment platform
- [ ] Supabase RLS policies are configured
- [ ] Supabase Auth sign-in methods are enabled
- [ ] No `console.log` statements in production code
- [ ] ESLint passes cleanly (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)

---

## License

Private — All rights reserved.
