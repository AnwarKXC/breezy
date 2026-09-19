# Feature Specification: Payments and Balance

**Feature Branch**: `010-payments-and-balance`

**Created**: 2026-06-28

**Status**: Clarified

**Input**: User description: "Phase 8 — Payments and Balance from d:\ai-practise\hotel-system\docs\plans\reservation_model_supabase_mcp_plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record and View Payments (Priority: P1)

The front desk user can record payments against a reservation — deposit, partial payment, or full payment — using cash, card, bank transfer, company credit, or voucher. The user can view the complete payment history for a reservation in chronological order.

**Why this priority**: Without the ability to record payments, the front desk cannot complete the check-in or check-out process. This is the foundation of all payment operations.

**Independent Test**: A reservation with total $500 receives a $200 deposit via card. The payment history shows one entry with type=deposit, method=card, amount=$200. The balance updates to $300.

**Acceptance Scenarios**:

1. **Given** a confirmed reservation with total $500, **When** the front desk records a $200 deposit via card, **Then** the payment history shows the deposit and the balance is $300.
2. **Given** a confirmed reservation with total $500, **When** the front desk records a $500 full payment via cash, **Then** the payment history shows the full payment and the balance is $0.
3. **Given** a reservation with no payments, **When** the front desk views payment history, **Then** an empty state is shown indicating no payments recorded.
4. **Given** a reservation with multiple payments (deposit + partial + final), **When** viewing payment history, **Then** entries are ordered chronologically with cumulative balance after each payment.

---

### User Story 2 - Balance Tracking and Guarantees (Priority: P2)

The system automatically tracks the reservation balance (total minus paid amount), enforces deposit requirements based on hotel policy, prevents overpayment unless explicitly allowed, and supports guarantee-only bookings where no payment is collected but a guarantee method is recorded.

**Why this priority**: Balance tracking is essential for financial accuracy. Without it, front desk staff cannot know what a guest owes at checkout.

**Independent Test**: A reservation with $500 total and a required 20% deposit policy receives no payment. The system prevents check-in and warns that a $100 deposit is required. After a $100 deposit, check-in is allowed and balance is $400.

**Acceptance Scenarios**:

1. **Given** a reservation with a required deposit policy (e.g., 20%), **When** the front desk attempts check-in without sufficient deposit, **Then** the system blocks check-in with a clear message showing the required deposit amount.
2. **Given** a reservation with total $500 and paid amount $600, **When** the system processes the overpayment, **Then** it returns an error unless overpayment is explicitly allowed for this reservation.
3. **Given** a reservation with billing type `company_invoice`, **When** the front desk views the balance, **Then** the balance shows $0 due (payment is via invoice, not collected) but the reservation is not marked as fully paid.
4. **Given** a guarantee-only reservation, **When** the front desk reviews payment status, **Then** the system shows a guarantee method on file with $0 collected and $0 balance due.

---

### User Story 3 - Refunds and Payment Corrections (Priority: P3)

Authorized users (admin, manager) can issue refunds that reference original payments. The refund reduces the paid amount and is recorded with a reason, actor, and timestamp. Payment corrections (e.g., wrong method recorded) are also supported with audit trail.

**Why this priority**: Refunds are needed for cancellations, overpayments, and guest compensation. They require an audit trail for financial accountability.

**Independent Test**: A reservation has a $200 card payment recorded. An admin issues a $50 refund referencing the original payment with reason "Partial cancellation". The paid amount drops to $150 and the refund is linked to the original payment in the history.

**Acceptance Scenarios**:

1. **Given** a reservation with a recorded payment of $200, **When** an admin issues a $50 refund referencing the original payment, **Then** the paid amount reduces to $150 and the refund entry links to the original payment.
2. **Given** a reservation with a recorded payment, **When** a refund exceeds the paid amount, **Then** the system rejects with an error.
3. **Given** a reservation with a payment recorded with wrong method, **When** an admin corrects the payment method, **Then** the original entry is preserved in history and a correction note is added.

---

### Edge Cases

- What happens when a reservation is cancelled with payments already recorded? The system should show payments as pending refund (or mark them for refund processing) — actual refund is handled as a separate transaction.
- What happens when a company invoice payment type is changed to guest-pays mid-stay? The invoice amount must be settled before changing billing arrangement.
- What about zero-balance reservations (complimentary)? No payment is required; balance is $0.
- What happens when multiple refunds are issued against the same original payment? Each refund reduces the paid amount; total refunds cannot exceed the original payment amount.
- What about partial check-out (one room from a multi-room reservation)? Balance should reflect only the checked-out portion if billing is per-room.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support recording payments against a reservation with fields: payment_type, method, amount, currency, transaction_reference, receipt_number, paid_by, notes, and created_by.
- **FR-002**: System MUST support these payment types: `deposit`, `partial_payment`, `full_payment`, `refund`, `company_invoice`, `guarantee_only`.
- **FR-003**: System MUST support these payment methods: `cash`, `card`, `bank_transfer`, `company_credit`, `voucher`, `other`.
- **FR-004**: System MUST automatically compute and store the balance (total_amount - paid_amount) after every payment change.
- **FR-005**: System MUST block overpayment (paid_amount > total_amount) unless overpayment is explicitly allowed via a permission flag.
- **FR-006**: System MUST allow refunds only when the refund amount does not exceed the paid amount minus previous refunds.
- **FR-007**: Refunds MUST reference the original payment they are refunding (parent_payment_id).
- **FR-008**: System MUST enforce deposit requirements based on `deposit_policy_rules` table (conditions by booking_type/billing_party, percentage or fixed_amount, enforced flag) before allowing check-in.
- **FR-009**: Company invoice payments MUST NOT mark the reservation as paid — they record the invoice reference and payment terms.
- **FR-010**: Guarantee-only bookings MUST NOT require payment — they record the guarantee method (e.g., card on file, company guarantee) and show $0 balance due.
- **FR-011**: System MUST maintain a chronological payment history per reservation with cumulative balance after each transaction.
- **FR-012**: Payment corrections (method change, amount adjustment) MUST preserve the original entry and add a correction entry with audit trail.
- **FR-013**: All payment events (record, refund, correction) MUST write an audit log entry with actor, timestamp, amount, and reason.
- **FR-014**: System MUST support payment status lifecycle: `pending` → `paid` / `failed` → `refunded`, where refunds reference a parent payment with status `paid`.
- **FR-015**: Payment recording and balance updates MUST be performed atomically inside a transactional RPC with `SELECT ... FOR UPDATE` to prevent concurrent write conflicts.

### Key Entities *(include if feature involves data)*

- **Reservation Payments**: Existing or new table recording each payment transaction against a reservation. Key attributes: payment_type, method, amount, status, transaction_reference, paid_by, parent_payment_id (for refunds), notes.
- **Reservation**: Existing table. Balance-related fields (paid_amount, balance_amount) must be kept in sync with payment transactions. May need a deposit_policy field or reference to policy configuration.
- **Payment Policy Configuration**: `deposit_policy_rules` table with hotel-defined rules for deposit requirements by booking_type, billing_party, percentage or fixed_amount, and enforced flag.
- **Payment Statuses**: `pending` (initial), `paid`/`failed` (terminal success/failure), `refunded` (applied to refund entries referencing a parent paid payment).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Front desk user can record a payment in under 30 seconds (3 clicks or less from the reservation detail view).
- **SC-002**: Balance updates correctly and immediately after every payment or refund — verified by comparing before/after totals for 20 test scenarios.
- **SC-003**: Overpayment is blocked in all cases unless explicitly permitted — verified by testing overpayment scenarios with and without permission flag.
- **SC-004**: Refunds correctly track back to original payment — verified by spot-checking 100% of refunds in a test set show the parent_payment_id linkage.
- **SC-005**: Deposit enforcement prevents check-in when deposit requirement is not met — verified by attempting check-in with insufficient deposit for 5 different policy configurations.

## Clarifications

### Session 2026-06-28

- Q: Does the `reservation_payments` table already exist or must it be created? → A: It does not exist — this phase creates it via a new migration.
- Q: What is the payment status lifecycle? → A: Three-state: `pending` → `paid` / `failed` → `refunded`. Refunds reference a parent `paid` payment.
- Q: How should deposit policy configuration be structured? → A: A `deposit_policy_rules` table with conditions (booking_type, billing_party), either `percentage` or `fixed_amount`, and an `enforced` boolean.
- Q: How to handle concurrent payment recording for the same reservation? → A: Use a transactional RPC with `SELECT ... FOR UPDATE` to lock the reservation row, ensuring atomic balance updates.

## Assumptions

- The `reservation_payments` table does not exist and will be created via migration as part of this phase.
- The existing `reservations` table already has `paid_amount`, `balance_amount`, and `total_amount` columns.
- Payment policy configuration (deposit rules) is stored in application configuration, not hardcoded.
- Refunds require `admin` or `manager` permission level — front desk cannot issue refunds without override permission.
- Company invoice payments are tracked in the same payments table with type `company_invoice` and method `company_credit`.
- Multi-currency payments are out of scope — all payments in a reservation use the same currency.
- Payment gateway integration (online payments, credit card processing) is out of scope — this phase covers manual payment recording only.
- Audit logging uses the existing audit log system from the project.
- Permissions use the existing RBAC system with action-level checks for payment operations.
