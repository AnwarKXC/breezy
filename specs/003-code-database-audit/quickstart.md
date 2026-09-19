# Quickstart: Existing Code and Database Audit

## Prerequisites

- Access to the hotel-system repository
- Supabase project credentials (for database inspection via MCP or CLI)
- Supabase MCP tools available (preferred) or Supabase CLI installed
- Node.js 20+ and pnpm installed

## Audit Steps

### 1. Inspect Code Modules

Read and document each of the 10 module areas:

```bash
# Examine directory structure
Get-ChildItem -Path src/modules/bookings -Recurse -Name
Get-ChildItem -Path src/modules/rooms -Recurse -Name
Get-ChildItem -Path src/modules/room-types -Recurse -Name
Get-ChildItem -Path src/modules/guests -Recurse -Name
Get-ChildItem -Path src/modules/contacts -Recurse -Name
Get-ChildItem -Path src/modules/pricing -Recurse -Name
Get-ChildItem -Path src/modules/accounting -Recurse -Name
Get-ChildItem -Path src/modules/logs -Recurse -Name
```

For each module, read the index file and key type/service files. Document per the format in `contracts/code-inventory-format.md`.

Write findings to: `findings/code-inventory.md`

### 2. Inspect Database Schema

```bash
# Option A: Supabase MCP (preferred)
#   Use MCP tools: list_tables with verbose output
#   List extensions, existing migrations

# Option B: Supabase CLI
supabase db inspect --project-ref <project-id>

# Option C: Direct SQL (last resort)
#   information_schema queries via psql or equivalent
```

Document per the format in `contracts/db-findings-format.md`.

Write findings to: `findings/database-findings.md`

### 3. Make Reuse/Extend/Create Decisions

For each of the 9 target reservation entities, compare code inventory and database findings to determine:

1. Does an equivalent table already exist?
2. Does it support the required functionality?
3. Can it be extended, or is a new table justified?

Document per the format in `contracts/reuse-extend-decision-format.md`.

Write decisions to: `findings/reuse-extend-decisions.md`

### 4. Compile Migration Impact List

Based on the decisions, enumerate every schema change needed, ordered by dependency:

- Table creation
- Column additions
- Index additions
- Constraint additions
- RLS policy changes

Write to: `findings/migration-impact-list.md`

### 5. Compile Risk Assessment

Document any issues found:

- Incomplete modules or type errors
- Schema/type mismatches
- Missing RLS policies or permission gaps
- Missing constraints or indexes
- Other architecture concerns

Write to: `findings/risk-assessment.md`

## Expected Duration

- Code inspection: ~30-45 minutes
- Database inspection: ~15-30 minutes
- Decision compilation: ~30 minutes
- Total: ~1.5-2 hours

## Validation

After completing all steps, verify:

- [ ] `findings/code-inventory.md` exists with all 10 module areas documented
- [ ] `findings/database-findings.md` exists with table inventory and relationships
- [ ] `findings/reuse-extend-decisions.md` exists with decisions for all 9 entities
- [ ] `findings/migration-impact-list.md` exists with ordered schema changes
- [ ] `findings/risk-assessment.md` exists with identified issues
- [ ] All decisions include rationale — no orphan "Create" decisions without justification
- [ ] No duplicate model introduced without written reason (FR-010)
