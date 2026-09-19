# Database Findings Format Contract

The database findings report (`findings/database-findings.md`) MUST follow this structure:

```markdown
# Existing Database Findings

## Tables

### [table_name]
| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| [col]  | [type] | [yes/no] | [default] | [PK, FK → table(col), unique, check] |

**Indexes**: [list of indexes]
**RLS Policies**: [list of policies with definitions]

## Relationships

[Description of foreign key relationships between tables]

## Enums

[Any Postgres enum types found]

## Existing Migrations

[Last migration version and key schema changes]

## Security Model

[RLS pattern: auth.uid() / profiles / custom roles / service-role only]
```
