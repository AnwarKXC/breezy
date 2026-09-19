# Research: Payments and Balance

**Phase**: 0 — Architecture Decisions | **Date**: 2026-06-28

## Decisions

### D-001: `reservation_payments` Table Design

**Problem**: A table to record all payment transactions against a reservation.

**Decision**: Create `reservation_payments` table with these columns:

```sql
CREATE TABLE reservation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'partial_payment', 'full_payment', 'refund', 'company_invoice', 'guarantee_only')),
  method TEXT NOT NULL CHECK (method IN ('cash', 'card', 'bank_transfer', 'company_credit', 'voucher', 'other')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  transaction_reference TEXT,
  receipt_number TEXT,
  paid_by TEXT NOT NULL DEFAULT 'guest' CHECK (paid_by IN ('guest', 'company', 'split')),
  parent_payment_id UUID REFERENCES reservation_payments(id),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Rationale**: Single table for all payment types, linked to reservation. Refunds use `parent_payment_id` self-reference (FR-007). Status column supports the three-state lifecycle (clarify Q2). Payment types and methods are text CHECK constraints — simpler than enums and consistent with existing project patterns.

**Indexes**: `(reservation_id)` for per-reservation queries. `(parent_payment_id)` for refund lookups. `(status)` for filtering pending/failed entries.

### D-002: Deposit Policy Rules Table

**Problem**: Configurable deposit requirements per clarify Q3.

**Decision**: Create `deposit_policy_rules` table:

```sql
CREATE TABLE deposit_policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type TEXT NOT NULL,
  billing_party TEXT,
  deposit_percentage NUMERIC(5,2),
  deposit_fixed_amount NUMERIC(12,2),
  enforced BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (deposit_percentage IS NOT NULL OR deposit_fixed_amount IS NOT NULL)
);
```

**Rationale**: Supports rules by booking_type (individual, company, group, travel_agent, internal) and optionally billing_party. Either percentage or fixed amount per rule. `enforced` flag allows soft rules that warn but don't block.

### D-003: Transactional Payment RPC with `SELECT FOR UPDATE`

**Problem**: Concurrent payment recording must not corrupt balance (clarify Q4).

**Decision**: Single `record_payment` RPC that locks the reservation row:

```sql
CREATE OR REPLACE FUNCTION record_payment(
  p_reservation_id UUID,
  p_payment_type TEXT,
  p_method TEXT,
  p_amount NUMERIC(12,2),
  p_currency TEXT DEFAULT 'USD',
  p_paid_by TEXT DEFAULT 'guest',
  p_transaction_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

Implementation:
1. `SELECT ... FROM reservations WHERE id = p_reservation_id FOR UPDATE` — lock row
2. Validate payment type against reservation state (e.g., no full_payment if total is 0 for guarantee_only)
3. If `p_payment_type = 'refund'`: validate parent_payment_id exists and status = 'paid'
4. If `overpayment check`: validate paid_amount + amount <= total_amount (unless overpayment allowed)
5. Insert into `reservation_payments` with status = 'paid' (or 'pending' for guarantee_only/company_invoice)
6. Update `reservations.paid_amount = paid_amount + amount`
7. Update `reservations.balance_amount = total_amount - paid_amount`
8. Write audit log
9. Return JSONB with payment_id, old/new balance

### D-004: Balance Calculation

**Problem**: Paid amount and balance must always be consistent.

**Decision**: Balance is computed and stored on the `reservations` table. All mutations (record_payment, refund) update it atomically inside the transactional RPC. No application-level reads calculate balance from payment rows.

**Rationale**: Read-path performance (single row read, no aggregation). Consistency guaranteed by the RPC lock. Refunds use negative adjustment to paid_amount (paid_amount = paid_amount - refund_amount).

### D-005: Payment Status State Machine

**Problem**: Payment records need a lifecycle.

**Decision**: Three-state lifecycle as clarified:

```
pending → paid / failed → refunded
```

- `pending`: Initial state for guarantee-only and company_invoice types (no money collected)
- `paid`: Money collected (deposit, partial, full payments — all start as paid on recording)
- `failed`: Payment attempt recorded but failed (e.g., card declined but logged)
- `refunded`: A refund entry that references a parent 'paid' payment

Only entries with `status = 'paid'` can have refund children.

### D-006: Guarantee-Only and Company Invoice Handling

**Problem**: These types don't collect money but must be tracked.

**Decision**: 
- `guarantee_only`: Creates a payment entry with status = 'pending', method records the guarantee method (e.g., 'card' for card on file). Does not change paid_amount or balance.
- `company_invoice`: Creates a payment entry with status = 'pending', paid_by = 'company'. Does not change paid_amount or balance. Invoice reference stored in transaction_reference.
