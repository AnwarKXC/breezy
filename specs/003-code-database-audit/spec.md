# Feature Specification: Existing Code and Database Audit

**Feature Branch**: `003-code-database-audit`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Phase 1 — Existing Code and Database Audit from docs/plans/reservation_model_supabase_mcp_plan.md"

## Clarifications

### Session 2026-06-28

- Q: Should audit findings be committed as permanent artifacts or kept as transient working notes? → A: Commit findings as markdown files under `specs/003-code-database-audit/findings/`
- Q: What inspection fallback chain if Supabase MCP is unavailable? → A: MCP first, then Supabase CLI `supabase db inspect`, then direct `information_schema` SQL queries
- Q: Should audit inspect actual data rows or only schema metadata? → A: Schema and FK relationships only — no querying of PII columns (guest names, contact details, document numbers)
- Q: How deep should code module inspection go? → A: Exports, types, and key functions — enough to understand each module's API surface and design patterns

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Code Module Inventory (Priority: P1)

The developer audits all existing code modules related to the reservation domain — bookings, rooms, room types, guests, contacts, pricing, accounting, permissions, and audit logs — examining each module's exported types, interfaces, and key functions to understand what already exists before designing new features.

**Why this priority**: Without knowing what already exists, any new reservation feature risks duplicating models, creating inconsistency, or breaking existing functionality. This is the foundation for every subsequent phase.

**Independent Test**: The audit produces a documented inventory of every relevant code module with its file paths, exported types, key functions, and current limitations, stored under `specs/003-code-database-audit/findings/`.

**Acceptance Scenarios**:

1. **Given** the project codebase, **When** the developer inspects `src/modules/bookings`, `src/modules/rooms`, `src/modules/room-types`, `src/modules/guests`, `src/modules/contacts`, `src/modules/pricing`, `src/modules/accounting`, `src/modules/logs`, `src/config/permissions.ts`, and `src/config/actionPermissions.ts`, **Then** a written inventory exists documenting each module's purpose, exported interfaces, and key functions.
2. **Given** the code inventory, **When** the developer compares against the target reservation model (reservations, reservation rooms, guests, company info, pricing items, payments, holds, notes, status history), **Then** each target table is explicitly marked as "exists and can be extended," "exists but needs modification," or "must be created."
3. **Given** the existing permissions system, **When** the developer reviews `src/config/permissions.ts` and `src/config/actionPermissions.ts`, **Then** an assessment is written documenting which permission actions already exist, which are missing, and whether the existing pattern can support new reservation-specific actions.

---

### User Story 2 - Database Schema Inspection (Priority: P1)

The developer inspects the live Supabase/Postgres database using Supabase MCP as the primary tool, falling back to Supabase CLI (`supabase db inspect`) then direct `information_schema` SQL queries if MCP is unavailable, to understand existing tables, columns, enums, foreign keys, indexes, RLS policies, functions, and migrations.

**Why this priority**: The database is the authoritative source of truth (per constitution Principle I). All schema decisions must be based on actual database state, not assumptions from code or documentation.

**Independent Test**: The audit produces a written database findings report covering tables, relationships, RLS policies, constraints, and migration history, stored under `specs/003-code-database-audit/findings/`.

**Acceptance Scenarios**:

1. **Given** access to the Supabase project, **When** the developer inspects existing tables via available tooling, **Then** a complete table inventory is produced listing all relevant tables (bookings, rooms, room_types, guests, contacts/companies, pricing, payments, invoices, profiles/users, roles/permissions, audit_logs) with their columns, types, and constraints.
2. **Given** the table inventory, **When** the developer inspects existing foreign key relationships, **Then** a relationship map is produced showing how bookings, rooms, guests, contacts, and pricing connect.
3. **Given** the database audit, **When** the developer inspects existing RLS policies on booking and room tables, **Then** a policy summary is written explaining whether the project uses auth.uid(), profiles, custom roles, or API-only service-role writes.

---

### User Story 3 - Reuse/Extend Decision Report (Priority: P1)

Based on the code and database audits, the developer produces a written report that makes explicit decisions: which existing tables/modules to reuse, which to extend, and which new tables to create — along with a migration impact list and risk assessment.

**Why this priority**: Ambiguity about reuse vs. create leads to wasted effort, duplicate models, and database drift. A signed-off decision report prevents these problems before implementation begins.

**Independent Test**: The report is reviewed and approved by a peer or stakeholder before any migration or code is written.

**Acceptance Scenarios**:

1. **Given** the code inventory and database findings, **When** the developer analyzes whether the existing `bookings` table can serve as the reservation parent or whether a new `reservations` table is needed, **Then** a documented decision with supporting evidence is produced.
2. **Given** the decision report, **When** all findings are compiled, **Then** four deliverables exist: existing database findings, reuse/extend decision, migration impact list, and risks list.
3. **Given** the completed audit, **When** a reviewer inspects the deliverables, **Then** no duplicate booking/guest/company/room model is introduced without written justification.

---

### Edge Cases

- What happens when a code module exists but is incomplete or has type errors? The audit should document the module's current state (exists but incomplete).
- What happens when the database schema does not match the TypeScript types? The audit should flag discrepancies.
- What happens when RLS policies are too permissive or missing? The audit should note security gaps.
- What happens when a table has data but lacks indexes or constraints? The audit should flag performance or integrity risks.
- What happens if database inspection reveals PII (guest names, phone, document numbers)? The audit must not read or copy actual PII values — only schema metadata, table counts, and foreign key relationships are inspected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST have its existing code modules (bookings, rooms, room_types, guests, contacts, pricing, accounting, logs, permissions) inspected and inventoried.
- **FR-002**: System MUST have its existing Supabase/Postgres database schema inspected through available tooling.
- **FR-003**: Developer MUST identify whether existing `bookings` table can be extended as reservation parent or if a new `reservations` table is required.
- **FR-004**: Developer MUST identify all existing foreign key relationships between bookings, rooms, guests, contacts, and pricing.
- **FR-005**: Developer MUST inspect and document all RLS policies affecting booking and room table writes.
- **FR-006**: Developer MUST inspect existing server services and API routes for bookings and rooms.
- **FR-007**: Developer MUST produce a written reuse/extend/create decision for each target model entity (reservations, reservation_rooms, reservation_guests, reservation_company_info, reservation_pricing_items, reservation_payments, reservation_holds, reservation_notes, reservation_status_history), committed as `specs/003-code-database-audit/findings/reuse-extend-decisions.md`.
- **FR-008**: Developer MUST produce a migration impact list enumerating every schema change needed, committed as `specs/003-code-database-audit/findings/migration-impact-list.md`.
- **FR-009**: Developer MUST produce a risk assessment documenting any issues found (incomplete modules, schema mismatches, missing constraints, permission gaps), committed as `specs/003-code-database-audit/findings/risk-assessment.md`.
- **FR-010**: No duplicate booking, guest, company, or room model may be introduced without written justification.

### Key Entities *(include if feature involves data)*

- **Audit Deliverables**: The outputs of the audit process — code inventory, database findings, reuse/extend decisions, migration impact list, and risk assessment.
- **Existing Modules**: The set of code modules currently in the project that are relevant to the reservation domain.
- **Database Schema**: The set of tables, views, enums, functions, and policies currently deployed in the Supabase project.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 10 code module areas are inspected and documented: bookings, rooms, room_types, guests, contacts, pricing, accounting, logs, permissions, actionPermissions.
- **SC-002**: All relevant database tables are inspected and documented with columns, types, constraints, and relationships.
- **SC-003**: Every target reservation entity (9 entities) has an explicit reuse/extend/create decision with rationale.
- **SC-004**: The reuse/extend decision is justified — no duplicate model is introduced without a written reason.
- **SC-005**: Migration impact list contains every schema change needed, ordered by dependency.
- **SC-006**: Risk assessment identifies any known problems in existing code or schema before new work begins.

## Assumptions

- The project has an existing codebase under `src/modules/` covering bookings, rooms, room_types, guests, contacts, pricing, accounting, and logs.
- The Supabase project is already configured and accessible via MCP tools, Supabase CLI, or direct SQL queries.
- The constitution's layered architecture (UI → Hook → RTK → Service → API) and database-first principles apply to any new reservation models created after the audit.
- The existing permissions system in `src/config/permissions.ts` and `src/config/actionPermissions.ts` follows a recognizable pattern that can be extended.
- The audit is a read-only analysis phase — no migrations or code changes are made during this phase.
