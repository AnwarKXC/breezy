# Contract: MCP Database Inspection Workflow

## Purpose

Before writing any reservation migration, the developer MUST inspect the existing database schema using Supabase MCP tools. This contract defines the inspection checklist, questions to answer, and expected output format.

## 1. Inspection Checklist

Use Supabase MCP tools to inspect:

```text
Tables:         bookings, rooms, room_types, guests, contacts, companies,
                pricing, price_overrides, payments, invoices, profiles/users,
                roles/permissions, audit_logs
Columns:        All columns on each table above
Enums:          booking_status, room_status, log_action, log_module
Foreign keys:   Relationships between tables above
Indexes:        Existing performance indexes
RLS policies:   Row-level security policies on each table
Functions:      Existing database functions/RPCs
Migrations:     Existing migration files in supabase/migrations/
Seed data:      Sample data in tables
```

## 2. Questions to Answer

| # | Question | Answer Format |
|---|----------|---------------|
| 1 | Does a bookings table already exist? | yes/no + schema summary |
| 2 | Does bookings already support company_id? | yes/no |
| 3 | Does bookings support multiple rooms? | yes/no (current single vs multi-room) |
| 4 | Does bookings support room status history? | yes/no |
| 5 | Does rooms include housekeeping_status? | yes/no (column names) |
| 6 | Does rooms include operational_status? | yes/no |
| 7 | Does contacts support company and individual types? | yes/no |
| 8 | Does pricing support room type pricing? | yes/no |
| 9 | Does pricing support company-specific overrides? | yes/no |
| 10 | Does audit_logs already exist? | yes/no + schema |
| 11 | Does RLS use auth.uid() or service role? | auth.uid / profiles / custom roles / API-only |

## 3. Expected Output Format

```markdown
## Existing Database Findings

- Existing booking table: yes/no + table name
- Existing room table: yes/no
- Existing contact/company support: yes/no
- Existing pricing support: yes/no
- Existing audit logs: yes/no
- RLS strategy: [auth.uid / profiles / service-role-only / hybrid]
- Tables to extend: [list]
- Tables to create: [list]
- Migrations needed: [count + purpose]
```

## 4. Fallback Procedure (from Clarification Q2)

If Supabase MCP tools are unavailable:

1. Use Supabase CLI: `supabase db dump --data-only` or `supabase db diff`
2. Query `information_schema` directly:
   ```sql
   SELECT table_name, column_name, data_type
   FROM information_schema.columns
   WHERE table_schema = 'public'
   ORDER BY table_name, ordinal_position;
   ```
3. Do NOT skip inspection — incomplete understanding before migration is the primary source of schema defects.
