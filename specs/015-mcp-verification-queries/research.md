# Research: MCP Verification Queries

## Query Catalog Format

**Decision**: Single markdown file at `supabase/migrations/scripts/mcp-verification-queries.md` with SQL blocks in fenced code blocks, organized by category.

**Rationale**: Markdown is human-readable, supports code fencing with syntax highlighting, allows inline comments for expected results, and renders nicely in GitHub and most editors. The `supabase/migrations/scripts/` path co-locates it with the standalone SQL verification script from Phase 15.

**Alternatives considered**: JSON query catalog — rejected because it adds parsing complexity for a documentation use case.

## Query Organization

**Decision**: Three sections matching the user stories:
1. Schema Verification (US1) — table/column/constraint existence
2. Data Integrity (US2) — conflict, hold, balance, company checks
3. Business Scenarios (US3) — occupied, due-out, company, breakdown queries

**Rationale**: Maps directly to spec user stories for traceability.

## MCP Tool Reference

**Decision**: All queries use `supabase_execute_sql` MCP tool. Documented in each query block header.

**Rationale**: This is the only Supabase MCP tool that accepts raw SQL. No other MCP tools needed for verification queries.

## Existing Verification Overlap

**Note**: Phase 15 (014-migration-rollout-plans) created a standalone SQL verification script with PASS/FAIL output. Phase 16 queries are complementary — they target specific business scenarios and data integrity checks best verified by a human interpreting results, not automated pass/fail. The Phase 15 script is for CI/automation; Phase 16 catalog is for administrator review.

## Query Structure Pattern

Each query block follows this format:

````markdown
### Query: <purpose>

**MCP Tool**: `supabase_execute_sql`
**Category**: <schema | integrity | business>
**Expected**: <what correct output looks like>

```sql
<SQL query>
```
````
