# Quickstart: Payments and Balance

**Phase**: 1 — Validation Scenarios | **Date**: 2026-06-28

Run these scenarios in Supabase SQL Editor to validate the implementation.

## Scenario 1: Record Deposit

```sql
-- 1. Create deposit_policy_rule (20% deposit required for individual bookings)
INSERT INTO deposit_policy_rules (booking_type, deposit_percentage, enforced, created_by)
VALUES ('individual', 20.00, true, (SELECT id FROM users WHERE role = 'admin' LIMIT 1));

-- 2. Call record_payment on a confirmed reservation (total=$500)
-- EXPECT: Payment recorded with type='deposit', status='paid'
-- Balance goes from $500 to $300
-- Payment history shows 1 entry with running_paid_amount=$200
```

## Scenario 2: Full Payment Clears Balance

```sql
-- 1. Reservation has total=$350, paid_amount=$0, balance=$350
-- 2. Call record_payment with payment_type='full_payment', method='cash', amount=350
-- EXPECT: Balance goes to $0
-- Payment history: running_paid_amount = $350
```

## Scenario 3: Overpayment Blocked

```sql
-- 1. Reservation has total=$200, paid_amount=$0
-- 2. Call record_payment with amount=250
-- EXPECT: Error — overpayment blocked (403)
-- 3. Call record_payment with amount=200
-- EXPECT: Success — balance = $0
```

## Scenario 4: Refund

```sql
-- 1. Reservation has a $200 card payment (payment_id = X)
-- 2. Call refund_payment(p_payment_id = X, amount = 50, reason = 'Partial cancellation')
-- EXPECT: Refund entry created with parent_payment_id = X
-- paid_amount drops from $200 to $150
-- balance goes from $300 to $350
```

## Scenario 5: Refund Exceeds Paid Amount

```sql
-- 1. Reservation has a $100 payment recorded
-- 2. Call refund_payment with amount = 150
-- EXPECT: Error — refund exceeds paid amount (400)
```

## Scenario 6: Guarantee-Only Booking

```sql
-- 1. Reservation has total=$0 (complimentary/guarantee-only)
-- 2. Call record_payment with payment_type='guarantee_only', method='card'
-- EXPECT: Payment recorded with status='pending'
-- paid_amount stays $0, balance stays $0
```

## Scenario 7: Company Invoice

```sql
-- 1. Company reservation with total=$1000
-- 2. Call record_payment with payment_type='company_invoice', paid_by='company'
-- EXPECT: Payment recorded with status='pending'
-- paid_amount stays $0 (invoice not payment)
-- balance shows $1000 due but invoice on file
```

## Scenario 8: Deposit Policy Enforcement

```sql
-- 1. Create deposit_policy_rule (20% enforced for individual)
-- 2. Reservation has total=$500, no payments
-- 3. Call check_deposit_requirement
-- EXPECT: deposit_required=true, required_amount=$100, shortfall=$100, met=false
-- 4. Record $100 deposit
-- 5. Call check_deposit_requirement
-- EXPECT: deposit_required=true, required_amount=$100, shortfall=$0, met=true
```

## Scenario 9: Payment History Running Balance

```sql
-- 1. Record $200 deposit → running_paid_amount = $200
-- 2. Record $300 full_payment → running_paid_amount = $500
-- 3. Refund $50 → running_paid_amount = $450
-- 4. Call get_payment_history
-- EXPECT: 3 entries, ordered chronologically, each with correct running_paid_amount
-- Final balance = $50
```
