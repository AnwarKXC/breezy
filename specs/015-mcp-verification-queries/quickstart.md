# Quickstart — MCP Verification Queries

## Prerequisites

- Supabase MCP server connected and available
- All migrations applied (including seed data from Phase 15)
- Access to `supabase_execute_sql` MCP tool

## Running Verification

### 1. Open the query catalog

```bash
cat supabase/migrations/scripts/mcp-verification-queries.md
```

Or view in your editor/IDE at `supabase/migrations/scripts/mcp-verification-queries.md`.

### 2. Run queries via MCP

For each query in the catalog:
1. Read the **Purpose** and **Expected** result
2. Copy the SQL query from the code fence
3. Invoke `supabase_execute_sql` with the query
4. Compare output to **Expected** result

### 3. Example: Verify table existence

Via MCP or coding agent:
```
Tool: supabase_execute_sql
Query: SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name IN ('reservations', 'reservation_rooms', ...);
Expected: 10 rows returned
```

### 4. Verify data integrity

```
Tool: supabase_execute_sql
Query: SELECT room_id, check_in_date, check_out_date, status
       FROM reservation_rooms
       WHERE status IN ('held', 'reserved', 'occupied')
       ORDER BY room_id, check_in_date;
Expected: Zero overlapping date ranges per room_id
```

### 5. Verify business scenarios

```
Tool: supabase_execute_sql
Query: SELECT r.reservation_number, g.first_name || ' ' || g.last_name AS guest
       FROM reservations r
       JOIN reservation_rooms rr ON rr.reservation_id = r.id
       JOIN guests g ON g.id = r.primary_guest_id
       WHERE rr.status = 'occupied' OR r.status = 'checked_in';
Expected: RSV-SEED-001 with Ahmed Ali
```

## Check Order

Run queries in this order for building confidence:
1. Schema (queries 1-6) — confirms migration applied
2. Integrity (queries 7-10) — confirms data is clean
3. Business (queries 11-15) — confirms model works end-to-end
