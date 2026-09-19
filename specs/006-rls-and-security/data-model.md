# Data Model: RLS Policy Matrix

## Overview

This phase adds no new database tables. The data model is a **policy matrix** defining which roles can perform which DML operations on which tables, including column-level restrictions and state-based conditions.

## Roles

| Role | JWT `app_role` | Base Access |
|------|---------------|-------------|
| Admin | `admin` | Full read/write including sensitive operations |
| Front Desk | `front_desk` | Read/write standard fields; no pricing override, cancel, delete, refund |
| Accountant | `accountant` | Read-only all tables; no writes |

## Policy Matrix

### reservations

| Operation | Admin | Front Desk | Accountant | Notes |
|-----------|-------|-----------|------------|-------|
| SELECT | ✅ | ✅ | ✅ | All roles read via `can_read_reservations()` |
| INSERT | ✅ | ✅ | ❌ | Writers via `can_write_reservations()` |
| UPDATE (standard) | ✅ | ✅ | ❌ | Writers via `can_write_reservations()` |
| UPDATE (pricing fields) | ✅ using `can_override_pricing()` | ❌ | ❌ | `subtotal_amount`, `discount_amount`, `tax_amount`, `service_amount`, `total_amount`, `paid_amount`, `balance_amount` |
| UPDATE (internal_notes) | ✅ admin | ❌ | ❌ | `can_manage_internal_notes()` |
| UPDATE (guarantee_type) | ✅ admin | ✅ standard only | ❌ | Admin can set any; front_desk can set non-override values |
| UPDATE (deleted_at) | ❌ | ❌ | ❌ | Soft-delete via RPC only |
| DELETE | ✅ admin only | ❌ | ❌ | `can_delete_reservations()` |

### reservation_rooms

| Operation | Admin | Front Desk | Accountant | Notes |
|-----------|-------|-----------|------------|-------|
| SELECT | ✅ | ✅ | ✅ | Via `can_read_reservations()` |
| INSERT | ✅ | ✅ | ❌ | Writers, but terminal state check via parent status |
| UPDATE (standard) | ✅ | ✅ | ❌ | Blocked if parent reservation is terminal (`checked_out`, `cancelled`, `no_show`) |
| UPDATE (force assign) | ✅ `can_force_assign_room()` | ❌ | ❌ | For dirty/maintenance room assignment |
| DELETE | ✅ admin | ❌ | ❌ | `can_delete_reservations()` |

### reservation_guests

| Operation | Admin | Front Desk | Accountant | Notes |
|-----------|-------|-----------|------------|-------|
| SELECT | ✅ | ✅ | ✅ | Via `can_read_reservations()` |
| INSERT | ✅ | ✅ | ❌ | Writers |
| UPDATE | ✅ | ✅ | ❌ | Writers |
| DELETE | ✅ admin | ❌ | ❌ | `can_delete_reservations()` |

### reservation_company_info

| Operation | Admin | Front Desk | Accountant | Notes |
|-----------|-------|-----------|------------|-------|
| SELECT | ✅ | ✅ | ✅ | Via `can_read_reservations()` |
| INSERT | ✅ | ✅ | ❌ | Writers |
| UPDATE (standard) | ✅ | ✅ | ❌ | Writers |
| UPDATE (credit override) | ✅ `can_override_pricing()` | ❌ | ❌ | Company credit limit changes |
| DELETE | ✅ admin | ❌ | ❌ | `can_delete_reservations()` |

### reservation_pricing_items

| Operation | Admin | Front Desk | Accountant | Notes |
|-----------|-------|-----------|------------|-------|
| SELECT | ✅ | ✅ | ✅ | Via `can_read_reservations()` |
| INSERT | ✅ | ✅ | ❌ | Writers; blocked if parent reservation is terminal |
| UPDATE (amounts) | ✅ `can_override_pricing()` | ❌ | ❌ | `unit_price`, `discount_percentage`, `tax_rate`, `total_price` |
| UPDATE (description only) | ✅ | ✅ | ❌ | Non-financial fields |
| DELETE | ✅ admin using `can_override_pricing()` | ❌ | ❌ | Matches price override permission |

### reservation_payments

| Operation | Admin | Front Desk | Accountant | Notes |
|-----------|-------|-----------|------------|-------|
| SELECT | ✅ | ✅ | ✅ | Via `can_read_reservations()` |
| INSERT (payment) | ✅ | ✅ | ❌ | `record_payment` — both admin and front_desk |
| INSERT (refund) | ✅ `can_refund_payment()` | ❌ | ❌ | Only admin can record negative amounts/refunds |
| UPDATE | ❌ | ❌ | ❌ | Payments are append-only; corrections via new entry + refund |
| DELETE | ✅ admin | ❌ | ❌ | `can_delete_reservations()` — full audit trail preservation needed |

### reservation_holds

| Operation | Admin | Front Desk | Accountant | Notes |
|-----------|-------|-----------|------------|-------|
| SELECT | ✅ | ✅ | ✅ | Via `can_read_reservations()` |
| INSERT | ✅ | ✅ | ❌ | Writers |
| UPDATE | ✅ | ✅ | ❌ | Writers |
| DELETE | ✅ admin | ❌ | ❌ | `can_delete_reservations()` |

### reservation_notes

| Operation | Admin | Front Desk | Accountant | Notes |
|-----------|-------|-----------|------------|-------|
| SELECT | ✅ | ✅ | ✅ | Via `can_read_reservations()` |
| INSERT | ✅ | ✅ | ❌ | Writers |
| UPDATE (standard notes) | ✅ | ✅ | ❌ | Writers |
| UPDATE (internal_notes flagged) | ✅ `can_manage_internal_notes()` | ❌ | ❌ | Notes flagged as internal/private |
| DELETE | ✅ admin | ❌ | ❌ | `can_delete_reservations()` |

### reservation_status_history (append-only)

| Operation | Admin | Front Desk | Accountant | Notes |
|-----------|-------|-----------|------------|-------|
| SELECT | ✅ | ✅ | ✅ | Via `can_read_reservations()` |
| INSERT | ✅ | ✅ | ❌ | Writers; status transitions happen via RPC |
| UPDATE | ❌ | ❌ | ❌ | Append-only — no updates |
| DELETE | ❌ | ❌ | ❌ | Immutable audit trail |

### room_status_history (append-only)

| Operation | Admin | Front Desk | Accountant | Notes |
|-----------|-------|-----------|------------|-------|
| SELECT | ✅ | ✅ | ✅ | Via `can_read_reservations()` |
| INSERT | ✅ | ✅ | ❌ | Writers |
| UPDATE | ❌ | ❌ | ❌ | Append-only — no updates |
| DELETE | ❌ | ❌ | ❌ | Immutable audit trail |

## Column-Level Security Map

| Table | Protected Columns | Required Permission |
|-------|------------------|-------------------|
| reservations | subtotal_amount, discount_amount, tax_amount, service_amount, total_amount, paid_amount, balance_amount | `can_override_pricing()` |
| reservations | internal_notes | `can_manage_internal_notes()` |
| reservations | guarantee_type | `can_manage_guarantee()` (admin: any, front_desk: non-override) |
| reservations | deleted_at | No direct UPDATE — RPC only |
| reservation_rooms | (all writes when parent status is terminal) | Terminal state block |
| reservation_company_info | company_credit_limit, credit_terms | `can_override_pricing()` |
| reservation_pricing_items | unit_price, discount_percentage, tax_rate, total_price | `can_override_pricing()` |
| reservation_payments | amount (negative/refund) | `can_refund_payment()` |
| reservation_notes | is_internal flag | `can_manage_internal_notes()` |

## State Transition Protection

The following reservation statuses are **terminal** for child-table writes:
- `checked_out`
- `cancelled`
- `no_show`

Terminal state protection applies to: reservation_rooms, reservation_pricing_items, reservation_payments (INSERT only for payments — new charges not allowed after terminal state).
