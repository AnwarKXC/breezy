# Quickstart: Pricing and Company Billing

**Phase**: 1 — Validation Scenarios | **Date**: 2026-06-28

Run these scenarios in Supabase SQL Editor to validate the implementation.

## Scenario 1: Seasonal Rate Pricing

```sql
-- 1. Create a seasonal rate for Deluxe rooms in July 2026
INSERT INTO seasonal_rates (name, start_date, end_date, room_type_id, override_rate, created_by)
VALUES ('Summer Peak', '2026-07-01', '2026-08-01', 
  (SELECT id FROM room_types WHERE name = 'Deluxe' LIMIT 1),
  250.00, (SELECT id FROM users WHERE role = 'admin' LIMIT 1));

-- 2. Create a draft reservation check-in July 15
-- 3. Call get_pricing_breakdown
-- EXPECT: Nights July 15-31 show rate = 250.00, source_type = 'seasonal_rate', source_label = 'Summer Peak'
```

## Scenario 2: Company Override Precedence

```sql
-- 1. Create seasonal rate for Deluxe rooms (rate = 250)
-- 2. Create company override for Acme Corp, Deluxe (rate = 220)
-- 3. Create draft reservation for Acme Corp in July
-- 4. Call get_pricing_breakdown
-- EXPECT: Nights show rate = 220.00, source_type = 'company_override', source_label = 'Acme Corp override'
-- Company override beats seasonal rate per ladder.
```

## Scenario 3: Manual Override (Admin)

```sql
-- 1. Create reservation with default_rate = 150
-- 2. Call apply_manual_override(reservation_id, room_id, '2026-07-15', 100.00, 'Guest compensation')
-- EXPECT: Returns success. Audit log has old=150, new=100, reason='Guest compensation'
-- Pricing breakdown shows source_type='manual_override', rate=100.00
```

## Scenario 4: Front Desk Override Threshold Enforcement

```sql
-- 1. Create reservation with default_rate = 200
-- 2. Call apply_manual_override as front_desk user with new_rate = 100 (50% below)
-- EXPECT: Returns 403 — override exceeds threshold
-- 3. Call apply_manual_override as front_desk with new_rate = 185 (within 10%)
-- EXPECT: Returns success
```

## Scenario 5: Billing Type — Company Room Only

```sql
-- 1. Create company reservation
-- 2. Call manage_billing_type(reservation_id, 'company_room_only', NULL)
-- EXPECT: Pricing breakdown shows room charges → company, incidentals → guest
-- company_name is set, company_share = room total, guest_share = 0
```

## Scenario 6: Billing Type — Split 50/50

```sql
-- 1. Create company reservation
-- 2. Call manage_billing_type(reservation_id, 'split', 50.00)
-- EXPECT: Pricing breakdown shows company_share = 50% of total, guest_share = 50% of total
```

## Scenario 7: Pricing Locked at Confirmation

```sql
-- 1. Create confirmed reservation with pricing items
-- 2. Modify seasonal rate (lower it significantly)
-- 3. Call get_pricing_breakdown
-- EXPECT: Breakdown still shows the rate from reservation_pricing_items (snapshot), not the new seasonal rate.
-- The confirmed reservation is not affected.
```

## Scenario 8: Manual Override Flagged on Date Change

```sql
-- 1. Create confirmed reservation with manual override
-- 2. Change reservation dates (simulate via update)
-- EXPECT: Override is flagged for review — price_override_audit_log retains record,
-- get_pricing_breakdown returns override with a "needs_review" indicator
```
