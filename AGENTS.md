# ECC for All AI Agents

This supplements the root `AGENTS.md` with cross-agent guidance for OpenCode, Codex, Claude Code, and other AI coding harnesses. Treat ECC as the shared baseline regardless of model/provider, then apply any harness-specific instructions in this file when relevant.

## Model Recommendations

Use the best available model for the task in the active harness. Prefer stronger reasoning models for architecture, debugging, schema work, security, and multi-file refactors; use faster/lower-cost models for routine edits, formatting, simple tests, and documentation cleanup.

| Task Type                         | Model Guidance                                      |
| --------------------------------- | --------------------------------------------------- |
| Routine coding, tests, formatting | Fast capable coding model                           |
| Complex features, architecture    | Strong reasoning model                              |
| Debugging, refactoring            | Strong reasoning model with good tool-use behavior  |
| Security review                   | Strong reasoning model plus security-review skill   |
| Database/Supabase work            | Strong reasoning model plus Supabase MCP/skill      |
| UI/UX implementation              | Strong frontend model plus frontend/responsive skills |

## Skills Discovery

Skills may be loaded from project, global, or harness-specific skill folders. In this repository, ECC-compatible skills are documented under `.agents/skills/` when present. Each skill contains:

- `SKILL.md` — Detailed instructions and workflow
- `agents/openai.yaml` or equivalent harness metadata when available

Available skills:

- tdd-workflow — Test-driven development with 80%+ coverage
- security-review — Comprehensive security checklist
- coding-standards — Universal coding standards
- frontend-patterns — React/Next.js patterns
- frontend-slides — Viewport-safe HTML presentations and PPTX-to-web conversion
- article-writing — Long-form writing from notes and voice references
- content-engine — Platform-native social content and repurposing
- market-research — Source-attributed market and competitor research
- investor-materials — Decks, memos, models, and one-pagers
- investor-outreach — Personalized investor outreach and follow-ups
- backend-patterns — API design, database, caching
- e2e-testing — Playwright E2E tests
- eval-harness — Eval-driven development
- strategic-compact — Context management
- api-design — REST API design patterns
- verification-loop — Build, test, lint, typecheck, security
- deep-research — Multi-source research with firecrawl and exa MCPs
- exa-search — Neural search via Exa MCP for web, code, and companies
- claude-api — Anthropic Claude API patterns and SDKs
- x-api — X/Twitter API integration for posting, threads, and analytics
- crosspost — Multi-platform content distribution
- fal-ai-media — AI image/video/audio generation via fal.ai
- dmux-workflows — Multi-agent orchestration with dmux

## MCP Servers

Treat project-local MCP configuration as the ECC baseline for the active harness. For Codex, this is usually `.codex/config.toml`. For OpenCode, prefer project/global OpenCode MCP configuration when present. The current ECC baseline commonly enables GitHub, Context7, Exa, Memory, Playwright, and Sequential Thinking; add heavier extras only when a task actually needs them.

For Codex TOML configs, ECC's canonical Context7 section name is `[mcp_servers.context7]`. The launcher package remains `@upstash/context7-mcp`; only the TOML section name is normalized for consistency with `codex mcp list` and the reference config.

### Automatic config.toml merging

For Codex environments, the sync script (`scripts/sync-ecc-to-codex.sh`) uses a Node-based TOML parser to safely merge ECC MCP servers into `~/.codex/config.toml`:

- **Add-only by default** — missing ECC servers are appended; existing servers are never modified or removed.
- **7 managed servers** — Supabase, Playwright, Context7, Exa, GitHub, Memory, Sequential Thinking.
- **Canonical naming** — ECC manages Context7 as `[mcp_servers.context7]`; legacy `[mcp_servers.context7-mcp]` entries are treated as aliases during updates.
- **Package-manager aware** — uses the project's configured package manager (npm/pnpm/yarn/bun) instead of hardcoding `pnpm`.
- **Drift warnings** — if an existing server's config differs from the ECC recommendation, the script logs a warning.
- **`--update-mcp`** — explicitly replaces all ECC-managed servers with the latest recommended config (safely removes subtables like `[mcp_servers.supabase.env]`).
- **User config is always preserved** — custom servers, args, env vars, and credentials outside ECC-managed sections are never touched.

## External Action Boundaries

Treat networked tools as read-only by default. Search, inspect, and draft freely within the user's requested scope, but require explicit user approval before posting, publishing, pushing, merging, opening paid jobs, dispatching remote agents, changing third-party resources, or modifying credentials.

When approval is ambiguous, produce a local plan or draft artifact instead of taking the external action. Preserve user config and private state unless the user specifically asks for a scoped change.

## Multi-Agent Support

Use the active harness's native multi-agent/subagent features when they help, but keep external actions bounded by approval rules. Codex supports multi-agent workflows behind the experimental `features.multi_agent` flag.

- Enable it in `.codex/config.toml` with `[features] multi_agent = true`
- Define project-local roles under `[agents.<name>]`
- Point each role at a TOML layer under `.codex/agents/`
- Use `/agent` inside Codex CLI to inspect and steer child agents

Sample role configs in this repo:

- `.codex/agents/explorer.toml` — read-only evidence gathering
- `.codex/agents/reviewer.toml` — correctness/security review
- `.codex/agents/docs-researcher.toml` — API and release-note verification

## Harness Compatibility Notes

| Feature      | Claude Code              | Codex CLI                                            | OpenCode                                      |
| ------------ | ------------------------ | ---------------------------------------------------- |
| Hooks        | 8+ event types           | Not yet supported                                    | Plugin/hook support varies by config         |
| Context file | CLAUDE.md + AGENTS.md    | AGENTS.md only                                       | AGENTS.md + `.opencode/agent/*.md`           |
| Skills       | Skills loaded via plugin | `.agents/skills/` directory                          | Project/global skills and external skill dirs |
| Commands     | `/slash` commands        | Instruction-based                                    | Commands/agents via OpenCode config/files    |
| Agents       | Subagent Task tool       | Multi-agent via `/agent` and `[agents.<name>]` roles | `.opencode/agent/*.md` and built-in agents   |
| Security     | Hook-based enforcement   | Instruction + sandbox                                | Permissions, plugins, and instruction policy |
| MCP          | Full support             | Supported via `config.toml` and `codex mcp add`      | Supported via OpenCode MCP config/tools      |

## Security Without Hooks

For any harness without reliable hooks, security enforcement is instruction-based:

1. Always validate inputs at system boundaries
2. Never hardcode secrets — use environment variables
3. Run `npm audit` / `pip audit` before committing
4. Review `git diff` before every push
5. Use `sandbox_mode = "workspace-write"` in config

## OpenCode Project Agent Guidance

This repository also has a project-local OpenCode agent at:

`.opencode/agent/hotel-system-engineer.md`

Use it as the default project specialist for coding, debugging, UI, database, security, tests, and feature work in this hotel system.

### Project Profile

- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- Data: Supabase/Postgres with RLS, RPC functions, and migrations in `supabase/migrations`.
- Testing: Vitest, Playwright, Testing Library.
- Main domains: reservations, legacy bookings, rooms, room types, guests, contacts, accounting, users, logs, settings.
- App routes live under `src/app/[locale]/(dashboard)` and API routes under `src/app/api`.
- Reservation code lives under `src/modules/reservations`, `src/services/reservationService.ts`, and `src/app/api/reservations`.
- Legacy booking code lives under `src/modules/bookings` and `src/services/bookingService.ts`.
- Room and room-type code lives under `src/modules/rooms`, `src/modules/room-types`, `src/app/api/rooms`, and `src/app/api/room-types`.
- Supabase generated types live at `src/services/supabase/database.types.ts`.

### Mandatory Skill Usage

OpenCode agents must check relevant skills before acting. If a task matches a skill, invoke it before reading, planning, editing, or asking clarifying questions.

- Use `supabase` for Supabase, Postgres, RLS, Auth, Storage, Edge Functions, migrations, RPCs, generated types, or database debugging.
- Use `next-best-practices` for Next.js App Router, route handlers, Server Components, Client Components, routing, metadata, or build behavior.
- Use `vercel-react-best-practices` for React components, data fetching, rendering, client state, or performance-sensitive UI.
- Use `frontend-design` for UI creation or UI changes.
- Use `responsive-design` for mobile layout, cards, tables, grids, forms, overflow, or adaptive behavior.
- Use `security-review` for auth, permissions, RLS, API routes, user input, payments, invoices, or sensitive data.
- Use `performance` for slow loading, bundle size, query speed, or rendering issues.
- Use `graphify` for architecture questions, flow tracing, file relationships, or codebase-wide explanations, especially when `graphify-out/graph.json` exists.
- Use `prompt-engineering-patterns` only for prompt templates, LLM workflows, structured outputs, or prompt reliability tasks.

### MCP And Plugin Workflow

- Use Supabase MCP for live schema/data inspection, read-only diagnostics, advisors/logs, and database behavior verification.
- Ask before applying remote Supabase schema changes unless the user explicitly requested a remote change.
- Use Playwright MCP or local Playwright for critical UI flow verification when user interactions change.
- Use GitHub MCP only when explicitly requested for GitHub tasks.
- Query existing `graphify-out/graph.json` before rebuilding a graph for codebase questions.

### Project Caveats

- The app has both legacy `bookings` and newer `reservations` with `reservation_rooms`.
- Local generated Supabase types may drift from the live database. When behavior is confusing, compare local migrations, generated types, and live Supabase MCP schema.
- Live reservation schema may use `check_in_date`, `check_out_date`, `room_count`, and lowercase enum values even if local files mention `check_in`, `check_out`, or uppercase values.
- Supabase RPC rows often return snake_case fields. Map them explicitly to app camelCase types before using them in UI logic.
- Full-project `npm run lint` can fail on pre-existing unrelated lint errors. For scoped feature work, run targeted lint on changed files and `npm run build` unless a full cleanup is requested.
- `graphify-out/*` may be modified by graph tooling. Do not revert or edit it unless explicitly asked.

### Engineering Rules

- Inspect with `glob`, `grep`, and targeted reads before editing.
- Use `apply_patch` for manual edits.
- Touch only files required for the task. Do not overwrite unrelated user changes.
- Prefer minimal diffs and keep logic local unless reuse is clear.
- Validate all API/server mutation inputs and enforce authorization.
- Frontend validation is not enough; revalidate on the server.
- Never hardcode secrets or service-role keys.
- Treat networked tools as read-only by default.

### Frontend Standards

- Preserve the existing stone/gray dashboard visual language unless the user asks for a redesign.
- Keep forms mobile-first, then enhance with responsive grids at larger breakpoints.
- Avoid horizontal overflow and keep touch targets usable.
- Do not add `useMemo` or `useCallback` by default. Use them only for clear expensive derived work or where this codebase already benefits from them.
- Prefer derived state during render over effect-driven duplicated state.
- For room/reservation UI, show availability clearly and keep server validation authoritative.

### Supabase Standards

- Start DB debugging with read-only queries: list tables, inspect columns, inspect functions, and compare expected rows to actual rows.
- Prefer local migration files for schema changes. Do not apply remote DDL unless the user explicitly approves it.
- Always consider RLS and Data API exposure for public tables/functions.
- For reservations, prevent overbooking with server-side checks. UI availability is advisory only.
- Room availability rule: `maintenance` blocks reservation; `cleaning` and `dirty` can be reserved unless the user changes that rule.

### Verification Policy

- UI change: targeted ESLint for changed files and `npm run build`.
- API/route change: targeted ESLint, `npm run build`, and focused API/data verification where practical.
- Supabase/RPC change: verify with Supabase MCP or a local SQL query against representative data.
- Test-sensitive bug fix: run the nearest Vitest or Playwright test when available.
- Before committing, inspect `git status`, `git diff`, and recent commits. Commit only when explicitly requested.
