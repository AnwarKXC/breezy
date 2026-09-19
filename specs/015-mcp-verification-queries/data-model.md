# Data Model — MCP Verification Queries

## Query Categories

### Schema Verification (6 queries)

| # | Query Name | Table/Target | Expected |
|---|-----------|-------------|----------|
| 1 | Table existence | `information_schema.tables` | 10 matching tables |
| 2 | Column data types | `information_schema.columns` | Date/amount/status columns correct |
| 3 | Check constraints | `information_schema.check_constraints` | Date ordering, positive values |
| 4 | Foreign keys | `information_schema.table_constraints` | FKs referencing rooms, guests, contacts |
| 5 | Index existence | `pg_indexes` | ≥15 reservation indexes |
| 6 | RLS status | `pg_tables` + `pg_policies` | All 10 tables RLS-enabled |

### Data Integrity (4 queries)

| # | Query Name | Table/Target | Expected |
|---|-----------|-------------|----------|
| 7 | Room conflicts | `reservation_rooms` | 0 overlapping active rows |
| 8 | Active holds | `reservation_holds` | All active holds have future expiry |
| 9 | Payment balance | `reservations` | balance = total - paid |
| 10 | Company references | `reservations` JOIN `reservation_company_info` | Each company booking has company row |

### Business Scenarios (5 queries)

| # | Query Name | Table/Target | Expected |
|---|-----------|-------------|----------|
| 11 | Occupied rooms | `reservation_rooms` JOIN `reservations` | RSV-SEED-001 room returned |
| 12 | Due-out today | `reservations` JOIN `reservation_rooms` | 0 or correct count |
| 13 | Company reservations | `reservations` JOIN `reservation_company_info` | RSV-SEED-003 returned |
| 14 | Booking type breakdown | `reservations` | individual: ≥1, company: ≥1 |
| 15 | Reservation summary | `reservations` | 3 seed reservations with correct statuses |

**Total**: 15 queries across 3 categories.
