# Feature Specification: Pricing and Company Billing

**Feature Branch**: `009-pricing-company-billing`

**Created**: 2026-06-28

**Status**: Clarified

**Input**: User description: "Phase 7 — Pricing and Company Billing from d:\ai-practise\hotel-system\docs\plans\reservation_model_supabase_mcp_plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explainable Per-Room Pricing Breakdown (Priority: P1)

The front desk user can view an itemized pricing breakdown for a reservation that shows each room's nightly rate, the source of that rate (default rate, company override, seasonal rate, room-specific rate, or manual override), any discounts applied, and the total. This helps the front desk answer guest questions about charges and resolve billing disputes.

**Why this priority**: Without an explainable pricing breakdown, front desk staff cannot answer basic guest questions about charges. This is the foundation for all billing operations.

**Independent Test**: A reservation with two rooms and a company price override is queried. The pricing breakdown shows: for each room, the nightly rate, the source as `company_override`, and the total amount. The breakdown is itemized per night.

**Acceptance Scenarios**:

1. **Given** a confirmed reservation with a company price override, **When** the front desk views the pricing breakdown, **Then** each room shows the override rate with `priceSource = 'company_override'` and the company name.
2. **Given** a reservation without any pricing overrides, **When** the front desk views pricing, **Then** each room shows the room type default rate with `priceSource = 'default_rate'`.
3. **Given** a reservation with a seasonal rate applied, **When** the front desk views pricing, **Then** the breakdown shows the seasonal rate with `priceSource = 'seasonal_rate'` and the season name.
4. **Given** a reservation where pricing has been manually overridden, **When** viewing the breakdown, **Then** it shows the override amount, the previous amount, the reason, and the user who performed the override.

---

### User Story 2 - Company Billing Rules and Payer Assignment (Priority: P2)

When creating or editing a company reservation, the front desk user can configure the billing arrangement: company as payer with room-only billing, company as payer with all-charges billing, split billing between company and guest, or guest as payer. The system applies company-specific pricing rules from the company price override table.

**Why this priority**: Company bookings have different billing requirements than individual bookings. Without billing rule configuration, the system cannot correctly route charges or generate the right invoices.

**Independent Test**: A company reservation is configured with "company as payer, room-only billing". The pricing breakdown shows room charges assigned to the company and incidentals assigned to the guest. Switching to split billing (50/50) redistributes the amounts accordingly.

**Acceptance Scenarios**:

1. **Given** a company reservation with `billing_type = 'company_room_only'`, **When** the pricing is reviewed, **Then** room charges are assigned to the company and the company price override is applied.
2. **Given** a company reservation with `billing_type = 'company_all_charges'`, **When** the pricing is reviewed, **Then** both room charges and estimated incidental charges are assigned to the company.
3. **Given** a company reservation with `billing_type = 'split'` and a 50/50 split percentage, **When** the pricing is reviewed, **Then** amounts are distributed accordingly between company and guest.
4. **Given** a company reservation with `billing_type = 'guest_pays'`, **When** the pricing is reviewed, **Then** all charges are assigned to the guest (company serves as reference only).
5. **Given** a company reservation, **When** the front desk changes the billing arrangement, **Then** the pricing breakdown updates to reflect the new distribution.

---

### User Story 3 - Manual Price Override with Audit Trail (Priority: P3)

Authorized users (admin and front desk within threshold) can manually override the price of a specific room on a reservation. The system records the old price, new price, reason, actor, and timestamp. The override reason is visible in the pricing breakdown.

**Why this priority**: Manual overrides are needed for guest compensation, promotional rates, and error correction. Full audit trail is required for financial accountability.

**Independent Test**: An admin overrides the nightly rate for a room from $150 to $100 with reason "Guest compensation for maintenance issue". The pricing breakdown shows the override, and the audit log contains an entry with old/new prices, reason, and actor.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they override a room's nightly rate, **Then** the new price appears in the breakdown with `priceSource = 'manual_override'` and the old price is recorded.
2. **Given** a front desk user, **When** they attempt an override exceeding their threshold (e.g., >10% below standard rate), **Then** the system rejects the override with a permission error.
3. **Given** a manual price override, **When** an auditor checks the audit log, **Then** they see the old price, new price, reason, actor, timestamp, and permission level used.
4. **Given** a reservation with an active manual override, **When** the dates or rooms change, **Then** the override is flagged for review (not silently lost).

---

### Edge Cases

- What happens when seasonal rates overlap with company price overrides? Company override takes precedence over seasonal rate (per pricing ladder: manual > company > seasonal > room-specific > default).
- What happens when dates change after pricing is set? The system recalculates pricing using the current applicable rates, and flags manual overrides for review.
- What happens when a billing arrangement is changed mid-stay? New charges follow the new arrangement; already-posted charges are unaffected.
- What about complimentary (zero-rate) bookings? The system should support setting a rate of 0 with a reason, tracked via manual override.
- What happens when a room's price is overridden and then the room type changes? The override is flagged for review.
- What happens when there is no company price override but company is set as payer? The company is billed at the default room type rate — the billing arrangement is independent of whether a pricing override exists.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a pricing breakdown per reservation room showing nightly rate, number of nights, total, currency, and the source of the rate (default_rate, company_override, seasonal_rate, room_specific_rate, or manual_override).
- **FR-002**: System MUST calculate pricing using this precedence: manual override > company override > seasonal rate > room-specific rate > default room type rate.
- **FR-003**: System MUST support seasonal rate tables with season name, date range (start_date, end_date), applicable room_type_id, and override rate.
- **FR-004**: System MUST support room-specific rate overrides with effective date range and override rate.
- **FR-005**: System MUST support company billing types: `company_room_only`, `company_all_charges`, `split`, and `guest_pays`.
- **FR-006**: System MUST store the billing arrangement on the reservation with a default of `guest_pays` for non-company bookings.
- **FR-007**: System MUST apply company price overrides from `company_price_overrides` table when the reservation has a company payer arrangement.
- **FR-008**: System MUST allow admin users to manually override any room's nightly rate with unlimited adjustment.
- **FR-009**: System MUST allow front desk users to manually override a room's nightly rate within a configurable threshold (default ±10% of the applicable standard rate).
- **FR-010**: System MUST record the following for every manual price override: old price, new price, reason (required text), actor user ID, timestamp, and the permission level used (admin or front_desk).
- **FR-011**: System MUST flag manual overrides for review when reservation dates, rooms, or room types change after the override was applied.
- **FR-012**: System MUST recalculate pricing when check-in date, check-out date, room, room type, company, guest count, or billing arrangement changes — but only for draft reservations. Once confirmed, pricing is locked and the stored `reservation_pricing_items` records are the authoritative source.
- **FR-013**: System MUST write audit log entries for: seasonal rate creation/modification, room-specific rate creation/modification, company price override changes, manual price overrides, and billing arrangement changes.
- **FR-014**: System MUST include pricing breakdown data in the `reservation_pricing_items` table with each line item showing amount, description, source type, and related entity reference.

### Key Entities *(include if feature involves data)*

- **Reservation Pricing Items** — Existing table. Per-room pricing lines. New fields may be needed for source type and reference IDs.
- **Seasonal Rates** — New table: season name, date range (start_date, end_date), room_type_id, override_rate, currency, status (active/inactive), created_by. Only affects pre-confirmation pricing — once confirmed, the rate is captured in `reservation_pricing_items`.
- **Room-Specific Rates** — New or extended: room_id, effective_date_range, override_rate, reason, created_by.
- **Company Price Overrides** — Existing table. Company_id, room_type_id, override_rate. May need effective date range for future-dated contracts.
- **Company Billing Settings** — New or extended on company/contact record: default_billing_type, credit_limit, invoice_schedule.
- **Reservations** — Existing table. New column: `billing_type` with enum values `company_room_only`, `company_all_charges`, `split`, `guest_pays`. New column: `split_percentage` for split billing arrangements.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Front desk users can view a complete pricing breakdown for a 5-night, 2-room reservation in under 3 seconds.
- **SC-002**: Pricing recalculates correctly when dates or rooms are changed — verified by comparing before/after totals for 10 test scenarios.
- **SC-003**: Manual price overrides are fully auditable — every override has a complete audit trail (old price, new price, reason, actor) verified by spot-checking 100% of overrides in a test set.
- **SC-004**: Seasonal rates are applied automatically for reservations falling within the season's date range — verified with test data spanning seasonal boundaries.
- **SC-005**: Company billing arrangements produce correct charge assignments — verified by creating reservations with each billing type and confirming the distribution matches the rules.

## Assumptions

- The existing `reservation_pricing_items` table from Phase 2 data model already supports per-room pricing line items.
- The existing `company_price_overrides` table is used for company-specific pricing.
- Seasonal rates apply to pre-confirmation pricing only — existing confirmed reservations are not retroactively repriced when a new season is added, because rates are locked at confirmation time.
- Pricing is locked at confirmation — `reservation_pricing_items` stores the actual rate and source at confirmation time. Post-confirmation changes (room moves, date changes) require a new manual override or a new pricing calculation with explicit user approval.
- Manual price override threshold for front desk is stored in application configuration, not hardcoded.
- Company billing arrangement is set at the reservation level (all rooms in the reservation share the same billing type).
- Split billing uses a single percentage for the entire reservation (e.g., 50/50 between company and guest), not per-room splits.
- This phase is backend RPC + migration + new pricing tables. UI components for the pricing breakdown display are deferred to a separate UI phase.
- Permission checks use the existing `can_override_pricing()` helper from Phase 6 for manual overrides.
- Currency is consistent per reservation — mixed-currency reservations are out of scope.

## Clarifications

### Session 2026-06-28

- Q: Are rates recalculated dynamically or locked at confirmation? → A: Locked at confirmation. Rates are captured into `reservation_pricing_items` at confirmation time. FR-012 recalculation only applies to draft reservations. Post-confirmation changes require manual override with audit.
