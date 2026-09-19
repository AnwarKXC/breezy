# RPC Contracts: Payments and Balance

**Phase**: 1 — Contract Design | **Date**: 2026-06-28

## RPC-001: `record_payment`

Records a payment against a reservation. Atomic — locks the reservation row.

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

**Permission**: Authenticated user with `front_desk` or `admin` role (via existing `get_session()` check).

**Description**:
1. `SELECT ... FROM reservations WHERE id = p_reservation_id FOR UPDATE` — lock row
2. Validate reservation exists and is not cancelled/expired
3. Validate payment_type: `full_payment` only allowed if total_amount > 0
4. Validate amount: must be > 0
5. Overpayment check: reject if `paid_amount + amount > total_amount` unless user has `payment:override_deposit` permission
6. Insert into `reservation_payments` with status = 'paid' (or 'pending' for guarantee_only/company_invoice)
7. Update `reservations` balance:
   - For 'paid' status: `paid_amount = paid_amount + amount; balance_amount = total_amount - paid_amount`
   - For 'pending' status: no balance change
8. Write audit log entry: "Payment recorded: {payment_type} {amount} {currency} via {method}"
9. Return JSONB: `{ success: true, payment_id, old_balance, new_balance }`

**Error cases**:
- Reservation not found → 404
- Reservation cancelled/expired → 400
- Overpayment without permission → 403
- Amount <= 0 → 400
- Invalid payment_type/method → 400

---

## RPC-002: `refund_payment`

Issues a refund referencing an existing paid payment.

```sql
CREATE OR REPLACE FUNCTION refund_payment(
  p_payment_id UUID,
  p_amount NUMERIC(12,2),
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

**Permission**: Authenticated user with `admin` or `manager` role (front desk cannot refund without override).

**Description**:
1. Lock the referenced payment row with `SELECT ... FOR UPDATE`
2. Validate payment exists, status = 'paid'
3. Validate that total refunds against this payment (including this one) do not exceed the payment amount
4. Get the reservation_id from the payment
5. Lock the reservation: `SELECT ... FROM reservations WHERE id = ... FOR UPDATE`
6. Insert refund entry into `reservation_payments` with:
   - payment_type = 'refund', status = 'refunded', parent_payment_id = p_payment_id
   - amount = p_amount, notes = p_notes (concatenated with reason)
7. Update reservation paid_amount: `paid_amount = paid_amount - p_amount`
8. Update reservation balance_amount
9. Write audit log: "Refund issued: {amount} for payment {p_payment_id}. Reason: {p_reason}"
10. Return JSONB: `{ success: true, refund_id, old_balance, new_balance }`

**Error cases**:
- Payment not found → 404
- Payment status is not 'paid' → 400
- Refund amount exceeds remaining refundable amount → 400
- Not authorized → 403

---

## RPC-003: `get_payment_history`

Returns chronological payment history for a reservation with running balance.

```sql
CREATE OR REPLACE FUNCTION get_payment_history(
  p_reservation_id UUID
) RETURNS TABLE(
  payment_id UUID,
  payment_type TEXT,
  method TEXT,
  amount NUMERIC(12,2),
  currency TEXT,
  status TEXT,
  paid_by TEXT,
  transaction_reference TEXT,
  receipt_number TEXT,
  parent_payment_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  running_paid_amount NUMERIC(12,2)
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

**Permission**: Authenticated user with `front_desk`, `admin`, or `accountant` role.

**Description**: Returns all payment rows for `p_reservation_id` ordered by `created_at ASC`. Computes `running_paid_amount` as a running total (adding paid amounts, subtracting refund amounts).

---

## RPC-004: `check_deposit_requirement`

Checks if the deposit requirement is met for a reservation.

```sql
CREATE OR REPLACE FUNCTION check_deposit_requirement(
  p_reservation_id UUID
) RETURNS TABLE(
  deposit_required BOOLEAN,
  required_amount NUMERIC(12,2),
  current_paid_amount NUMERIC(12,2),
  shortfall NUMERIC(12,2),
  met BOOLEAN,
  policy_rule_id UUID,
  message TEXT
) LANGUAGE plpgsql STABLE SET search_path = public
```

**Permission**: No access check — called by other RPCs or display logic.

**Description**: Looks up matching `deposit_policy_rules` by reservation's booking_type and billing_party. Computes required amount (percentage of total or fixed amount). Returns whether the deposit requirement is met and the shortfall amount.
