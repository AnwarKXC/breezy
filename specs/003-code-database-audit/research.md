# Research: Existing Code and Database Audit

## Research Context

This feature implements Phase 1 from `docs/plans/reservation_model_supabase_mcp_plan.md`. The goal is to understand what already exists in the hotel-system codebase and Supabase database before designing new reservation features. No technology unknowns exist — the audit answers "what already exists" rather than "how to build something new."

## Audit Methodology

### Code Module Inspection

**Approach**: For each of the 10 module areas, read the module's index/exports file and key TypeScript files to document:
- Exported types and interfaces
- Key service functions (signatures only)
- Existing patterns (naming conventions, error handling, validation approach)
- Current limitations or known gaps

**Depth**: Exports, types, and key functions only (per Q4 clarification).

### Database Schema Inspection

**Approach**: Use Supabase MCP as primary tool, with fallback chain:
1. Supabase MCP tools (`list_tables` with verbose output, `list_extensions`)
2. Supabase CLI `supabase db inspect`
3. Direct `information_schema` SQL queries

**Scope**: Schema metadata and FK relationships only — no PII data queried (per Q3 clarification).

**RLS Inspection**: Document existing policies on booking and room tables. Determine whether the project uses `auth.uid()`, profiles, custom roles, or API-only service-role writes.

### Decision Framework for Reuse/Extend/Create

Each of the 9 target reservation entities is evaluated against:

| Decision | Criteria |
|----------|----------|
| **Reuse as-is** | Existing table/module fully supports the requirement; no schema or API changes needed |
| **Extend** | Existing table/module exists but needs new columns, indexes, or minor API additions |
| **Create** | No existing equivalent; building new table/module is required |

The `bookings` table receives special analysis: does it already serve as a reservation parent, or is a separate `reservations` table justified?

### Deliverable Documents

All findings are committed under `specs/003-code-database-audit/findings/` (per Q1 clarification):

| Document | File | Content |
|----------|------|---------|
| Code Module Inventory | `findings/code-inventory.md` | Purpose, exports, types, key functions, limitations per module |
| Database Findings | `findings/database-findings.md` | Tables, columns, types, constraints, FKs, enums, indexes, RLS policies |
| Reuse/Extend Decisions | `findings/reuse-extend-decisions.md` | Decision per entity with rationale |
| Migration Impact List | `findings/migration-impact-list.md` | Ordered list of schema changes needed |
| Risk Assessment | `findings/risk-assessment.md` | Known problems: incomplete modules, schema mismatches, missing constraints, permission gaps |

## Reference Documents

- `docs/plans/reservation_model_supabase_mcp_plan.md` — Target domain model (Section 3), non-negotiable rules (Section 1), MCP workflow (Section 2)
- `specs/003-code-database-audit/spec.md` — Feature specification with clarifications
- `.specify/memory/constitution.md` — Project architecture and governance rules

## Decisions Made During Planning

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Deliverable format | Markdown files under `findings/` | Permanent, reviewable, referenceable by downstream phases |
| MCP fallback chain | MCP → CLI → SQL | Maximizes inspection metadata richness |
| PII handling | Schema only, no data rows | Security compliance without sacrificing structural understanding |
| Code audit depth | Exports, types, key functions | Sufficient for reuse decisions without exhaustive line review |
