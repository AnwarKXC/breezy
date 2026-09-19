# Index Conventions

## Naming

All indexes follow the convention from Phase 2 migrations:

```
idx_{table}_{column(s)}
```

Examples:
- `idx_reservations_status` — single column
- `idx_reservations_dates` — composite (check_in_date, check_out_date)
- `idx_reservation_rooms_room_dates` — composite FK + date range
- `idx_reservation_holds_active` — composite with meaningful qualifier

Special cases:
- **Unique constraints**: Named as constraint name (e.g., `reservation_guests_single_primary`)
- **Exclusion constraints**: Named with `_no_overlap` suffix (e.g., `reservation_rooms_no_overlap`)

## Index Types

- **B-tree** — default for all FK lookups, status filters, date range searches
- **GiST** — only for the exclusion constraint (`btree_gist` extension) and optional daterange index if needed
- **No BRING, GIN, or hash indexes** — not required at current scale

## Partial Indexes

Preferred pattern for soft-deleted tables:

```sql
WHERE deleted_at IS NULL
```

For FK columns that are nullable:

```sql
WHERE {fk_column} IS NOT NULL AND deleted_at IS NULL
```

For status-specific lookups:

```sql
WHERE status = 'active'
```

## Migration Strategy

- Indexes belong in a migration file after all table DDL
- Use `CREATE INDEX IF NOT EXISTS` for idempotent application
- Only create new migration files — never modify existing deposited migrations
- Indexes can be safely added without blocking reads/writes in Postgres (CONCURRENTLY if needed for large tables)
