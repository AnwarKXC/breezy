# Hotel System Reservation Scenarios and Agent Implementation Playbook

Source basis: `GRAPH_REPORT.md` for `hotel-system`, generated 2026-06-30 from commit `9fe0096e`.

This file is designed for a coding agent. It converts the system graph findings into implementation scenarios with expected behavior, solution direction, and acceptance tests.

---

## 0. Agent operating rules

Before implementing any scenario, the agent must follow these rules:

1. Treat reservation creation as a transactional workflow, not a simple insert.
2. Keep `bookings` compatibility in mind if legacy booking features still exist.
3. Use service/RPC boundaries for business-critical actions: availability, holds, confirmation, payments, refunds, price overrides, and lifecycle transitions.
4. Enforce RBAC at the API/service layer and RLS at the database layer.
5. Always create audit logs for status, room, pricing, payment, refund, invoice, and permission-sensitive actions.
6. Do not trust client-calculated pricing, balance, permissions, or availability.
7. Use idempotency keys for confirm, payment, refund, and external/API retry flows.
8. Use database transactions and row locks where double booking, double payment, or stale balance is possible.
9. Keep reservation status, room assignment status, payment status, and invoice status as separate but synchronized state machines.
10. Every scenario must include automated tests or at least a verifiable manual test path.

Recommended implementation order:

```text
1. Database schema + enums + indexes + RLS
2. Availability RPC/service
3. Hold creation/release/expiry
4. Reservation CRUD and confirmation
5. Lifecycle actions
6. Pricing/company billing
7. Payments/balance/refunds
8. Invoice/accounting integration
9. Room details/history
10. UI flows, export/reporting, E2E tests
```

---

## 1. Core system state machines

### 1.1 Reservation status

Suggested statuses:

```text
DRAFT
HELD
CONFIRMED
CHECKED_IN
CHECKED_OUT
CANCELLED
NO_SHOW
EXPIRED
FAILED
```

Allowed transitions:

| From | To | Action |
|---|---|---|
| DRAFT | HELD | Create hold |
| DRAFT | CONFIRMED | Confirm without hold |
| HELD | CONFIRMED | Confirm from hold |
| HELD | EXPIRED | Hold timeout |
| CONFIRMED | CHECKED_IN | Check in |
| CHECKED_IN | CHECKED_OUT | Check out |
| CONFIRMED | CANCELLED | Cancel |
| HELD | CANCELLED | Cancel draft/held reservation |
| CONFIRMED | NO_SHOW | Mark no-show |

Terminal statuses:

```text
CHECKED_OUT
CANCELLED
NO_SHOW
EXPIRED
FAILED
```

Terminal statuses must reject most update actions except permitted audit/history reads.

### 1.2 Payment status

Suggested statuses:

```text
UNPAID
DEPOSIT_REQUIRED
PARTIALLY_PAID
PAID
OVERDUE
REFUNDED
PARTIALLY_REFUNDED
COMPANY_BILLED
GUARANTEED_ONLY
```

### 1.3 Invoice status

Suggested statuses:

```text
DRAFT
ISSUED
PARTIALLY_PAID
PAID
VOIDED
REFUNDED
```

---

# Scenario catalogue

Each scenario contains:

- **Trigger**: when the scenario happens.
- **Solution**: what the agent should implement.
- **Acceptance tests**: how to prove it works.

---

## A. Data model, migration, and compatibility scenarios

### Scenario A01 — Legacy bookings and new reservations coexist

**Trigger:** The system already has `bookings`, while the graph also shows a richer `reservations` model.

**Solution:**

- Keep legacy `bookings` reads working.
- Introduce `reservations` as the source of truth for new reservation workflows.
- Add mapping fields such as `legacy_booking_id`, `source_booking_id`, or compatibility views if needed.
- Ensure accounting/invoice flows that still use `bookingId` can resolve a reservation.
- Avoid duplicate status logic by defining one canonical reservation lifecycle.

**Acceptance tests:**

- Existing booking list still loads.
- New reservation can be created without breaking old booking pages.
- Invoice wizard can select either a legacy booking or a new reservation.
- No duplicated reservation is created for the same legacy booking.

---

### Scenario A02 — Reservation schema migration

**Trigger:** The agent needs to add reservation tables.

**Solution:**

Create or verify these tables:

```text
reservations
reservation_rooms
reservation_guests
reservation_company_info
reservation_pricing_items
reservation_payments
reservation_holds
reservation_notes
reservation_status_history
room_status_history
deposit_policy_rules
price_override_audit_log
```

Add enums for reservation status, payment status, billing type, guest role, room assignment state, and log action values.

**Acceptance tests:**

- Migration runs cleanly on an empty database.
- Migration runs safely when existing bookings exist.
- Table existence verification passes.
- Enum value verification passes.
- Required indexes and foreign keys exist.

---

### Scenario A03 — Reservation relationships and constraints

**Trigger:** A reservation needs rooms, guests, pricing, payments, notes, and company info.

**Solution:**

- Use `reservations` as the parent record.
- Store one or more `reservation_rooms` rows.
- Store primary and secondary guests in `reservation_guests`.
- Store company billing in `reservation_company_info`.
- Store price breakdown in `reservation_pricing_items`.
- Store immutable payment records in `reservation_payments`.
- Store notes in `reservation_notes`.
- Add foreign keys with appropriate `ON DELETE` rules.

**Acceptance tests:**

- Deleting a test reservation removes child draft-only rows if allowed.
- Confirmed financial/payment rows are not silently deleted.
- Reservation details API returns rooms, guests, pricing, payments, company info, and notes.

---

### Scenario A04 — RLS enabled on reservation tables

**Trigger:** Reservation tables are created in Supabase/Postgres.

**Solution:**

- Enable RLS on every reservation-related table.
- Use helper-based policies.
- Allow read/write by role and action, not by UI screen.
- Protect terminal statuses using status subqueries.
- Ensure service role can run controlled server-side operations.

**Acceptance tests:**

- Anonymous user cannot read reservation rows.
- Front desk can create reservations if permission exists.
- Accountant can read but cannot change lifecycle status.
- Direct table update is blocked when policy disallows it.

---

### Scenario A05 — API response envelope consistency

**Trigger:** Reservation APIs return inconsistent success/error shapes.

**Solution:**

Standardize all reservation APIs:

```ts
{
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: unknown;
}
```

**Acceptance tests:**

- Successful create returns `ok: true` and reservation data.
- Validation error returns `ok: false` with `VALIDATION_ERROR`.
- Permission error returns `PERMISSION_DENIED`.
- Conflict returns `RESERVATION_CONFLICT` or `ROOM_UNAVAILABLE`.

---

## B. Availability scenarios

### Scenario B01 — Basic availability: all rooms free

**Trigger:** User searches dates where no room is booked, held, blocked, or under maintenance.

**Solution:**

- Implement `get_room_availability` or equivalent service/RPC.
- Accept date range, room type filters, capacity filters, company/contact filters, and optional pricing context.
- Return rooms with status `available` and effective price.

**Acceptance tests:**

- Search returns all matching rooms.
- Room type and capacity filters work.
- Availability response includes room id, room type, capacity, status, and price.

---

### Scenario B02 — Full overlap with existing reservation

**Trigger:** Requested stay fully overlaps an existing confirmed reservation.

**Solution:**

- Check overlap using `requested_check_in < existing_check_out AND requested_check_out > existing_check_in`.
- Exclude terminal statuses such as cancelled/expired.
- Return `unavailable` with conflict details.

**Acceptance tests:**

- Existing reservation June 10–15 blocks search June 10–15.
- Existing reservation June 10–15 blocks search June 11–14.
- Conflict response includes reservation id or safe conflict metadata.

---

### Scenario B03 — Partial overlap with existing reservation

**Trigger:** Requested stay overlaps only part of another reservation.

**Solution:**

Use the same overlap rule as B02; do not only compare equal dates.

**Acceptance tests:**

- Existing reservation June 10–15 blocks search June 8–12.
- Existing reservation June 10–15 blocks search June 13–18.
- Back-to-back booking June 15–18 is allowed if checkout/check-in boundary does not overlap.

---

### Scenario B04 — Active hold blocks availability

**Trigger:** Another user has a non-expired hold on the room/date range.

**Solution:**

- Include `reservation_holds` in availability conflict detection.
- Only active/unexpired holds block availability.
- Return conflict reason `held`.

**Acceptance tests:**

- Active hold blocks matching room.
- Hold from another reservation blocks room.
- Response clearly marks the room as held/unavailable.

---

### Scenario B05 — Expired hold ignored

**Trigger:** A hold exists but `expires_at` is in the past.

**Solution:**

- Availability query filters expired holds out.
- Optional cleanup job/RPC marks old holds as expired.
- Do not require cleanup to make expired holds non-blocking.

**Acceptance tests:**

- Expired hold does not block availability.
- `expire_reservation_holds()` marks old holds expired.
- Search after expiry returns the room as available.

---

### Scenario B06 — Maintenance room prevented

**Trigger:** A room is under maintenance during requested dates.

**Solution:**

- Add room status or room block checks to availability.
- Treat maintenance/out-of-order as unavailable.
- Include reason `maintenance` or `out_of_order`.

**Acceptance tests:**

- Room marked maintenance is not bookable.
- Admin can see reason; public/guest UI may only show unavailable.
- Maintenance history is visible in room history.

---

### Scenario B07 — Blocked room prevented

**Trigger:** Admin blocks a room for owner use, repair, or operational reasons.

**Solution:**

- Store room blocks with date ranges.
- Add blocks to the same overlap conflict logic.
- Prevent holds and confirmed reservations for blocked rooms.

**Acceptance tests:**

- Blocked room cannot be held.
- Blocked room cannot be confirmed.
- Unblocked dates remain available.

---

### Scenario B08 — No matching filters

**Trigger:** User searches with filters that match no room.

**Solution:**

- Return an empty result with `ok: true`, not an exception.
- Include filter metadata in response.

**Acceptance tests:**

- Search invalid room type returns empty set.
- Search capacity above all room capacities returns empty set.
- UI displays empty state instead of crashing.

---

### Scenario B09 — Company pricing shown in availability

**Trigger:** User searches availability for a company/contact with negotiated rates.

**Solution:**

- Availability service should call `get_effective_rate` or pricing service.
- Return base rate plus effective company rate and source.
- Never let client decide final company price.

**Acceptance tests:**

- Company A sees company override price.
- User without company sees standard/seasonal price.
- Availability response identifies price source.

---

### Scenario B10 — Conflict details returned safely

**Trigger:** Room is unavailable for one or more reasons.

**Solution:**

- Return conflict details for internal staff.
- Avoid exposing sensitive guest details to unauthorized roles.
- Include reason code, date range, and conflict type.

**Acceptance tests:**

- Admin sees conflict reason and linked reservation reference.
- Front desk sees enough information to act.
- Unauthorized user does not see private guest details.

---

### Scenario B11 — Concurrent last-room search and booking

**Trigger:** Two users search and try to book the last available room.

**Solution:**

- Search alone does not guarantee availability.
- Confirmation must re-check availability inside a transaction.
- Use exclusion constraints or `SELECT FOR UPDATE`/advisory lock around room/date inventory.

**Acceptance tests:**

- Two concurrent confirmations for same room/date result in one success and one conflict.
- No duplicate confirmed reservations exist for same room/date overlap.

---

## C. Hold scenarios

### Scenario C01 — Create draft reservation with hold

**Trigger:** User starts a booking and selects room/date before final confirmation.

**Solution:**

- Create `reservations` row with `DRAFT` or `HELD` status.
- Create `reservation_holds` rows for selected room/date.
- Set `expires_at` using configured hold duration.
- Return expiration time to UI.

**Acceptance tests:**

- Draft reservation is created.
- Hold row exists with correct room/date range.
- Availability excludes held room.

---

### Scenario C02 — Hold collision detection

**Trigger:** Another user tries to hold the same room/date while an active hold exists.

**Solution:**

- Use transaction and locking, ideally `FOR UPDATE NOWAIT` or equivalent.
- Detect active overlapping holds.
- Return `HOLD_CONFLICT`.

**Acceptance tests:**

- First hold succeeds.
- Second overlapping hold fails.
- Non-overlapping hold succeeds.

---

### Scenario C03 — Release hold manually

**Trigger:** User cancels booking flow or staff releases held inventory.

**Solution:**

- Implement `DELETE /api/reservations/[id]/holds` or service equivalent.
- Mark hold as released instead of hard-delete if audit is needed.
- Update reservation status to `DRAFT`, `CANCELLED`, or `EXPIRED` depending on context.

**Acceptance tests:**

- Released hold no longer blocks availability.
- Audit log records release.
- Unauthorized role cannot release another reservation's hold.

---

### Scenario C04 — Hold expiry

**Trigger:** Hold timeout passes before confirmation.

**Solution:**

- Implement `expire_reservation_holds()` RPC/job.
- Availability must ignore expired holds even before cleanup.
- UI must prevent confirm if hold expired.

**Acceptance tests:**

- Expired hold becomes non-blocking.
- Confirm from expired hold fails with clear error.
- Expiry job is idempotent.

---

### Scenario C05 — Confirm from hold

**Trigger:** User confirms before hold expiry.

**Solution:**

- Transactionally re-check room/date conflicts.
- Convert hold to confirmed reservation-room allocation.
- Mark hold consumed or inactive.
- Set reservation status to `CONFIRMED`.

**Acceptance tests:**

- Hold converts to confirmed reservation.
- Hold no longer appears as separate blocking record.
- Confirmation audit log exists.

---

## D. Reservation creation scenarios

### Scenario D01 — Create single-room reservation

**Trigger:** Staff or guest creates a normal reservation for one room.

**Solution:**

- Validate dates, room, guest, occupancy, rate, and source.
- Create reservation parent row.
- Create one `reservation_rooms` row.
- Store pricing snapshot.
- Return reservation detail.

**Acceptance tests:**

- Valid single-room reservation is saved.
- Room availability is reduced.
- Pricing items match returned total.

---

### Scenario D02 — Create multi-room reservation

**Trigger:** Booker reserves multiple rooms under one reservation.

**Solution:**

- Store one parent reservation.
- Store multiple `reservation_rooms` rows.
- Allow separate occupancy and guest assignments per room.
- Calculate totals per room and parent total.

**Acceptance tests:**

- Reservation with two room types is saved.
- Each room has independent guests and pricing.
- Cancelling one room does not automatically cancel all unless requested.

---

### Scenario D03 — Missing required fields

**Trigger:** Request lacks required dates, guest, room, or pricing information.

**Solution:**

- Validate at API boundary.
- Return `VALIDATION_ERROR` with field-level messages.
- Do not create partial records unless explicitly creating a draft.

**Acceptance tests:**

- Missing check-in returns field error.
- Missing primary guest returns field error.
- Invalid date range returns field error.

---

### Scenario D04 — Invalid date range

**Trigger:** Checkout is before or equal to check-in for overnight stay.

**Solution:**

- Reject checkout <= checkin unless explicit day-use mode exists.
- Store date-only or timestamp consistently.

**Acceptance tests:**

- Checkout before check-in rejected.
- Same-day rejected unless day-use enabled.
- Valid date range accepted.

---

### Scenario D05 — Occupancy exceeds capacity

**Trigger:** Guest count exceeds room capacity.

**Solution:**

- Validate against room type/room capacity.
- Consider adults, children, and extra bed rules.
- Return `OCCUPANCY_EXCEEDED`.

**Acceptance tests:**

- 5 guests in 2-capacity room rejected.
- Extra bed rule allows valid extended occupancy if configured.
- Multi-room occupancy validated per room.

---

### Scenario D06 — Add primary guest

**Trigger:** Reservation is created or updated with guest details.

**Solution:**

- Require exactly one primary guest for confirmed reservations.
- Link to existing contact/guest if selected.
- Create guest profile if new guest is submitted.

**Acceptance tests:**

- Confirm without primary guest fails.
- Reservation detail shows primary guest.
- Existing contact is reused instead of duplicated.

---

### Scenario D07 — Add additional guests

**Trigger:** More than one guest is staying.

**Solution:**

- Store guests in `reservation_guests`.
- Support role/type fields such as primary, accompanying adult, child.
- Attach guests to reservation-level or room-level depending on model.

**Acceptance tests:**

- Multiple guests save correctly.
- Room-level guest assignment works for multi-room reservation.
- Guest list appears in reservation details.

---

### Scenario D08 — Company info attached to reservation

**Trigger:** Reservation uses company billing or negotiated rates.

**Solution:**

- Store company/contact reference in `reservation_company_info`.
- Store billing type.
- Store company pricing source in pricing items.

**Acceptance tests:**

- Company reservation includes company info.
- Billing type is persisted.
- Pricing source reflects company rate if applicable.

---

### Scenario D09 — Reservation notes

**Trigger:** Staff adds internal or guest-facing notes.

**Solution:**

- Implement notes API: `GET /api/reservations/[id]/notes`, `POST /api/reservations/[id]/notes`.
- Store author, visibility, body, timestamps.
- Audit note creation if required.

**Acceptance tests:**

- Staff can add note.
- Unauthorized role cannot read private notes.
- Notes appear in chronological order.

---

### Scenario D10 — Idempotent reservation confirmation

**Trigger:** User double-clicks confirm, browser retries, or API call is retried.

**Solution:**

- Require idempotency key for confirm.
- Store request key and result.
- Repeated request returns same reservation result.

**Acceptance tests:**

- Same confirm request sent twice creates one confirmed reservation.
- Second response returns same reservation id.
- Different idempotency key follows normal validation.

---

### Scenario D11 — Confirmation conflict after draft

**Trigger:** Draft was created, but room becomes unavailable before confirmation.

**Solution:**

- Re-check availability inside confirmation transaction.
- If conflict exists, do not confirm.
- Return conflict with available alternatives if possible.

**Acceptance tests:**

- Draft can be created.
- Another confirmed reservation blocks same room.
- Draft confirmation fails safely.

---

### Scenario D12 — Unauthenticated create request

**Trigger:** API request has no valid session/token.

**Solution:**

- Use existing session verification helpers.
- Return `UNAUTHENTICATED`.
- Do not leak data.

**Acceptance tests:**

- Anonymous create is rejected.
- Anonymous availability may be allowed only if business rules allow it.
- Audit/security log records suspicious attempts if desired.

---

## E. Reservation lifecycle scenarios

### Scenario E01 — Confirm reservation

**Trigger:** Draft/held reservation is finalized.

**Solution:**

- Validate status is `DRAFT` or `HELD`.
- Re-check availability.
- Lock pricing snapshot.
- Set status to `CONFIRMED`.
- Create status history and audit log.

**Acceptance tests:**

- Confirmed reservation cannot be double-confirmed with side effects.
- Pricing is locked.
- Status history contains confirmation event.

---

### Scenario E02 — Cancel reservation

**Trigger:** Staff or permitted user cancels reservation.

**Solution:**

- Implement `POST /api/reservations/[id]/cancel`.
- Validate cancellation is allowed for current status.
- Store cancellation reason.
- Release rooms/holds.
- Apply cancellation fee rules if implemented.

**Acceptance tests:**

- Confirmed reservation cancels successfully.
- Checked-out reservation cannot be cancelled.
- Cancelled reservation no longer blocks availability.

---

### Scenario E03 — Check in

**Trigger:** Guest arrives and staff checks them in.

**Solution:**

- Implement `POST /api/reservations/[id]/check-in`.
- Allow only from `CONFIRMED`.
- Verify room assignment exists or assign room.
- Update room status to occupied.
- Log status and room history.

**Acceptance tests:**

- Confirmed reservation checks in.
- Draft/cancelled reservation cannot check in.
- Room status becomes occupied.

---

### Scenario E04 — Check out

**Trigger:** Guest leaves and stay is completed.

**Solution:**

- Implement `POST /api/reservations/[id]/check-out`.
- Allow only from `CHECKED_IN`.
- Validate balance/invoice policy.
- Update room status to dirty/available depending housekeeping model.
- Create audit/history records.

**Acceptance tests:**

- Checked-in reservation checks out.
- Confirmed-but-not-checked-in reservation cannot check out.
- Balance policy is enforced.

---

### Scenario E05 — Mark no-show

**Trigger:** Guest does not arrive by no-show cutoff.

**Solution:**

- Implement no-show action from `CONFIRMED` only.
- Store reason/time/user.
- Apply no-show charge if policy exists.
- Release room inventory after no-show processing.

**Acceptance tests:**

- Confirmed reservation can become no-show.
- Checked-in reservation cannot become no-show.
- No-show appears in status history and reports.

---

### Scenario E06 — Room change

**Trigger:** Guest needs to move to another room.

**Solution:**

- Validate new room availability for remaining stay.
- End old room assignment.
- Add new room assignment.
- Update room status history for both rooms.
- Audit old room/new room.

**Acceptance tests:**

- Room change succeeds when new room is available.
- Room change fails when new room conflicts.
- History shows old and new room.

---

### Scenario E07 — Stay extension success

**Trigger:** Guest wants to extend checkout date.

**Solution:**

- Implement `POST /api/reservations/[id]/extend`.
- Check room availability for extension period only.
- Add pricing items for additional nights.
- Update checkout date and balance.
- Audit old and new checkout dates.

**Acceptance tests:**

- Extension succeeds when room is free.
- New nights are priced and added.
- Reservation checkout date changes.

---

### Scenario E08 — Stay extension conflict

**Trigger:** Guest wants to extend, but room is booked after checkout.

**Solution:**

- Detect conflict for requested extension period.
- Return `EXTENSION_CONFLICT`.
- Optionally suggest room change alternatives.

**Acceptance tests:**

- Extension fails when next reservation exists.
- Original reservation dates remain unchanged.
- Conflict response includes date/room reason.

---

### Scenario E09 — Terminal status protection

**Trigger:** User attempts to modify checked-out, cancelled, no-show, expired, or failed reservation.

**Solution:**

- Add status checks in service layer.
- Add RLS/policy protection where possible.
- Allow read/history only unless admin repair workflow exists.

**Acceptance tests:**

- Cancelled reservation cannot be checked in.
- Checked-out reservation cannot have room changed.
- Terminal update attempt returns clear error.

---

### Scenario E10 — Reservation history

**Trigger:** Staff opens reservation history.

**Solution:**

- Implement `GET /api/reservations/[id]/history`.
- Combine status, room, payment, price, note, and audit events.
- Return chronological events.

**Acceptance tests:**

- Confirm, check-in, payment, and room change appear in history.
- Events include actor and timestamp.
- Unauthorized role cannot view restricted metadata.

---

## F. Pricing and company billing scenarios

### Scenario F01 — Standard room rate

**Trigger:** No seasonal, room-specific, company, or manual override applies.

**Solution:**

- Use room type base/default rate.
- Store pricing item with source `standard`.
- Snapshot rate at confirmation.

**Acceptance tests:**

- Standard price is returned.
- Pricing item source is standard.
- Total equals nightly rate × nights plus taxes/fees.

---

### Scenario F02 — Seasonal rate pricing

**Trigger:** Requested stay falls within configured seasonal rate dates.

**Solution:**

- Implement `get_effective_rate` using date-based rate rules.
- Price each night according to effective date.
- Store per-night pricing items or breakdown.

**Acceptance tests:**

- Seasonal date uses seasonal rate.
- Non-seasonal date uses standard rate.
- Mixed stay calculates each night correctly.

---

### Scenario F03 — Room-specific rate

**Trigger:** A physical room has special pricing.

**Solution:**

- Check room-specific rate after or before seasonal rate according to priority rules.
- Store price source as `room_specific`.
- Document priority order.

**Acceptance tests:**

- Special room returns room-specific price.
- Other rooms of same type use default/seasonal price.
- Pricing source is correct.

---

### Scenario F04 — Company override precedence

**Trigger:** Reservation is linked to a company with negotiated pricing.

**Solution:**

- Company pricing should override standard/seasonal if business rule says so.
- Use `get_pricing_breakdown` or `get_effective_rate`.
- Store company id and rate source.

**Acceptance tests:**

- Company override beats standard rate.
- Company override precedence is deterministic.
- Removing company recalculates only before confirmation.

---

### Scenario F05 — Manual override by admin/manager

**Trigger:** Authorized user manually changes price.

**Solution:**

- Implement `apply_manual_override` RPC/service.
- Check `can_override_pricing` helper.
- Store old price, new price, reason, actor, timestamp.
- Create `price_override_audit_log` and general audit log.

**Acceptance tests:**

- Admin can override price.
- Override reason is required.
- Audit log contains old/new values.

---

### Scenario F06 — Front desk override threshold

**Trigger:** Front desk user attempts a price override.

**Solution:**

- Allow only within configured threshold.
- Reject override above threshold or require manager approval.
- Store approval metadata if approved.

**Acceptance tests:**

- Small allowed override succeeds.
- Large override is rejected for front desk.
- Manager/admin can approve according to policy.

---

### Scenario F07 — Unauthorized price override blocked

**Trigger:** User without pricing permission attempts override.

**Solution:**

- Enforce permission in API/service and RLS.
- Return `PERMISSION_DENIED`.
- Optionally log denied attempt.

**Acceptance tests:**

- Accountant cannot override reservation price.
- Guest/public user cannot override price.
- No pricing row changes after denied request.

---

### Scenario F08 — Pricing locked at confirmation

**Trigger:** Reservation is confirmed.

**Solution:**

- Copy effective pricing into immutable pricing snapshot rows.
- Later rate changes must not affect confirmed reservations unless explicit reprice action exists.

**Acceptance tests:**

- Change seasonal rate after confirmation.
- Existing confirmed reservation total remains unchanged.
- Draft reservation can still recalculate before confirmation.

---

### Scenario F09 — Billing type: guest pays all

**Trigger:** Normal individual reservation.

**Solution:**

- Billing type is `guest_pays_all` or equivalent.
- Balance due belongs to guest.
- Invoice billed to guest/contact.

**Acceptance tests:**

- Reservation balance assigned to guest.
- Invoice recipient is guest.
- Company fields are optional.

---

### Scenario F10 — Billing type: company pays all

**Trigger:** Company covers all reservation charges.

**Solution:**

- Billing type is `company_pays_all`.
- Company contact is required.
- Invoice recipient is company.
- Balance can become `COMPANY_BILLED` when invoice is issued.

**Acceptance tests:**

- Missing company rejected.
- Company invoice generated.
- Guest balance is zero or excluded depending policy.

---

### Scenario F11 — Billing type: company room only

**Trigger:** Company pays room charges, guest pays extras.

**Solution:**

- Split pricing items by payer: company vs guest.
- Room/night items assigned to company.
- Add-ons/extras assigned to guest.
- Invoice split or folio split must reflect payer.

**Acceptance tests:**

- Room charge appears on company invoice.
- Extra charge appears on guest invoice/folio.
- Balance by payer is correct.

---

### Scenario F12 — Billing type: split 50/50

**Trigger:** Company and guest split charges equally.

**Solution:**

- Split eligible charges by percentage.
- Apply consistent rounding rules.
- Store split detail in pricing/billing records.

**Acceptance tests:**

- 1000 total creates 500 company / 500 guest.
- Odd amounts round consistently.
- Invoice totals match reservation balance.

---

### Scenario F13 — Billing type changed before confirmation

**Trigger:** Staff changes billing type while reservation is draft/held.

**Solution:**

- Allow recalculation before confirmation.
- Rebuild pricing/billing allocation.
- Audit billing type change if important.

**Acceptance tests:**

- Draft billing type can change.
- Totals recalculate correctly.
- Old allocation is replaced or versioned cleanly.

---

### Scenario F14 — Billing type changed after confirmation

**Trigger:** Staff tries to change billing type on confirmed reservation.

**Solution:**

- Require permission and reason.
- Do not silently mutate historical pricing.
- Create adjustment records or revised billing allocation.
- Audit change.

**Acceptance tests:**

- Unauthorized user cannot change billing after confirmation.
- Authorized change creates audit event.
- Existing invoice rules are respected.

---

## G. Payments and balance scenarios

### Scenario G01 — Deposit requirement check

**Trigger:** Reservation rate/policy requires a deposit.

**Solution:**

- Implement `check_deposit_requirement`.
- Use deposit policy rules by rate, company, booking source, date, or status.
- Return required amount and due date.

**Acceptance tests:**

- Deposit-required rate returns amount.
- Non-deposit rate returns no requirement.
- Confirm can enforce deposit rule if configured.

---

### Scenario G02 — Record deposit

**Trigger:** Guest pays partial amount before or at confirmation.

**Solution:**

- Implement `record_payment` RPC/service.
- Store payment type `deposit`.
- Use transaction and row lock on reservation balance.
- Update payment status to partial/deposit paid.

**Acceptance tests:**

- Deposit payment is stored.
- Balance decreases by deposit amount.
- Payment history shows deposit.

---

### Scenario G03 — Full payment clears balance

**Trigger:** Guest pays full reservation amount.

**Solution:**

- Record payment.
- Recalculate paid amount and balance.
- Set payment status to `PAID`.

**Acceptance tests:**

- Full payment creates zero balance.
- Status becomes paid.
- Duplicate request does not double pay.

---

### Scenario G04 — Partial payment

**Trigger:** Guest pays less than total due.

**Solution:**

- Record amount.
- Balance remains greater than zero.
- Status becomes `PARTIALLY_PAID`.

**Acceptance tests:**

- Partial payment stored.
- Balance is correct.
- Reservation remains not fully paid.

---

### Scenario G05 — Overpayment blocked

**Trigger:** User attempts to pay more than balance due.

**Solution:**

- Validate amount inside payment transaction.
- Return `OVERPAYMENT_NOT_ALLOWED` unless overpayment credits are explicitly supported.

**Acceptance tests:**

- Payment greater than due is rejected.
- Balance remains unchanged.
- No payment record is inserted.

---

### Scenario G06 — Refund payment

**Trigger:** Staff refunds a prior payment.

**Solution:**

- Implement `refund_payment` RPC/service.
- Reference original payment if possible.
- Store refund as negative payment or separate refund type.
- Update balance and payment status.

**Acceptance tests:**

- Refund reduces paid amount.
- Payment history shows refund.
- Audit log includes reason.

---

### Scenario G07 — Refund exceeds paid amount

**Trigger:** Staff tries to refund more than paid.

**Solution:**

- Lock reservation/payment records.
- Calculate refundable amount.
- Reject if refund amount exceeds refundable balance.

**Acceptance tests:**

- Refund above paid amount fails.
- No refund record is inserted.
- Clear error returned.

---

### Scenario G08 — Guarantee-only booking

**Trigger:** Reservation is guaranteed by card/company/agent but no money is collected now.

**Solution:**

- Store guarantee type and metadata.
- Set payment status `GUARANTEED_ONLY` or reservation guarantee flag.
- Do not create fake payment amount.

**Acceptance tests:**

- Guaranteed reservation can be confirmed if policy allows.
- Balance remains due.
- Guarantee appears in reservation detail.

---

### Scenario G09 — Company invoice instead of immediate payment

**Trigger:** Company-billed reservation is confirmed without payment.

**Solution:**

- Set payer to company.
- Create company invoice or mark balance as company billed when invoice issued.
- Do not mark guest payment as paid unless actual payment exists.

**Acceptance tests:**

- Company-billed reservation can be confirmed.
- Company invoice can be generated.
- Balance reporting separates company AR from guest due.

---

### Scenario G10 — Idempotent payment request

**Trigger:** Payment gateway callback or user retry sends payment twice.

**Solution:**

- Require `idempotency_key` or payment provider reference.
- Unique index on provider reference/key.
- Return existing payment result on duplicate.

**Acceptance tests:**

- Same payment callback twice creates one payment record.
- Balance decreases once only.
- Duplicate response is safe.

---

### Scenario G11 — Payment history

**Trigger:** Staff opens payment history for reservation.

**Solution:**

- Implement `get_payment_history`.
- Return payments, refunds, method, actor, reference, timestamps.
- Mask sensitive payment details.

**Acceptance tests:**

- Deposit, full payment, and refund appear chronologically.
- Card details are masked.
- Unauthorized role cannot view restricted details.

---

### Scenario G12 — Payment success but reservation update fails

**Trigger:** External payment succeeds but system fails before marking reservation paid.

**Solution:**

- Store payment webhook/callback idempotently.
- Use reconciliation job or admin recovery queue.
- Never lose provider reference.
- Mark reservation as `PAYMENT_RECONCILIATION_REQUIRED` if needed.

**Acceptance tests:**

- Simulated DB failure leaves recoverable record/log.
- Retrying callback completes update safely.
- No duplicate payment after recovery.

---

## H. Invoice and accounting scenarios

### Scenario H01 — Create invoice from reservation

**Trigger:** Staff creates invoice for a reservation.

**Solution:**

- Invoice wizard should load reservation rooms, pricing items, payments, company billing, and balance.
- Create invoice draft linked to reservation id and/or legacy booking id.
- Copy charges as invoice items.

**Acceptance tests:**

- Reservation charges appear in invoice draft.
- Company billing determines invoice recipient.
- Invoice total matches reservation balance allocation.

---

### Scenario H02 — Invoice wizard select-booking/reservation

**Trigger:** User starts invoice creation and selects a booking/reservation.

**Solution:**

- Support search by confirmation number, guest, company, date, and status.
- Warn if reservation is cancelled/no-show/checked-out depending invoice rules.
- Avoid duplicate invoice if invoice already exists unless allowed.

**Acceptance tests:**

- User can select reservation.
- Existing invoice warning appears.
- Invalid status shows warning or blocked state.

---

### Scenario H03 — Review charges before issuing invoice

**Trigger:** Invoice wizard moves to review step.

**Solution:**

- Show room charges, add-ons, taxes, fees, discounts, deposits, and payer split.
- Allow authorized manual invoice items before issue.
- Validate totals before save.

**Acceptance tests:**

- Charges match pricing snapshot.
- Deposit is visible.
- Total calculation is correct.

---

### Scenario H04 — Apply deposit to invoice

**Trigger:** Reservation has deposit payments.

**Solution:**

- Display deposit as applied payment/credit.
- Reduce invoice balance due, not invoice gross charges.
- Prevent applying same deposit twice.

**Acceptance tests:**

- Deposit reduces amount due.
- Duplicate invoice generation does not double-apply deposit.
- Payment history links to invoice if needed.

---

### Scenario H05 — Add manual invoice item

**Trigger:** Staff adds extra fee/service/charge.

**Solution:**

- Allow only on draft invoice.
- Require item type, amount, tax behavior, and description.
- Recalculate total.

**Acceptance tests:**

- Draft invoice accepts item.
- Issued/paid invoice rejects item edit.
- Ledger/total updates correctly.

---

### Scenario H06 — Issue invoice

**Trigger:** Staff finalizes invoice.

**Solution:**

- Validate invoice has recipient and items.
- Lock invoice items.
- Assign invoice number.
- Create ledger entries.
- Audit issue action.

**Acceptance tests:**

- Draft becomes issued.
- Invoice number is unique.
- Ledger entries exist.

---

### Scenario H07 — Edit restrictions after invoice issued

**Trigger:** User tries to edit issued invoice.

**Solution:**

- Block edits to issued/paid invoices.
- Allow credit note/adjustment flow if needed.
- Require void/reissue for corrections.

**Acceptance tests:**

- Draft invoice can be edited.
- Issued invoice cannot be edited directly.
- Paid invoice cannot be changed silently.

---

### Scenario H08 — Void invoice

**Trigger:** Staff voids an invoice.

**Solution:**

- Allow void only for eligible statuses.
- Require reason.
- Reverse ledger effects if already posted.
- Audit void.

**Acceptance tests:**

- Draft/issued unpaid invoice can be voided if policy allows.
- Paid invoice void is blocked or requires refund/credit workflow.
- Void reason appears in audit trail.

---

### Scenario H09 — Record invoice payment

**Trigger:** Payment is made against invoice rather than reservation directly.

**Solution:**

- Record payment at invoice level and synchronize reservation balance.
- Avoid duplicate reservation payment if same payment is linked.
- Ledger entries must balance.

**Acceptance tests:**

- Invoice payment reduces invoice balance.
- Reservation payment/balance reflects payment.
- Ledger report is correct.

---

### Scenario H10 — Accounting reports

**Trigger:** Dashboard/accounting page shows revenue and receivables.

**Solution:**

- Include reservation/invoice/payment data in daily revenue, monthly revenue, AR aging, and outstanding balance reports.
- Separate guest due vs company AR.

**Acceptance tests:**

- Paid invoice appears in revenue.
- Company unpaid invoice appears in AR aging.
- Cancelled/no-show handling follows policy.

---

## I. Guest and contact scenarios

### Scenario I01 — New guest profile

**Trigger:** Guest does not exist in contacts/guests.

**Solution:**

- Create contact/guest record from reservation form.
- Validate email/phone if present.
- Link created guest to reservation.

**Acceptance tests:**

- New guest is created.
- Reservation references guest.
- Invalid email/phone rejected or warned according to policy.

---

### Scenario I02 — Existing guest selected

**Trigger:** Staff chooses existing contact/guest.

**Solution:**

- Use contact selector/search.
- Link existing guest without duplicating profile.
- Optionally update missing fields if staff edits.

**Acceptance tests:**

- Existing guest linked.
- No duplicate contact created.
- Contact details page shows reservation.

---

### Scenario I03 — Contact not found

**Trigger:** Staff searches for contact and none exists.

**Solution:**

- Show contact-not-found state.
- Allow create-new-contact flow.
- Preserve reservation form state.

**Acceptance tests:**

- Search returns empty state.
- New contact can be created from flow.
- Reservation form keeps entered dates/rooms.

---

### Scenario I04 — Merge duplicate contacts

**Trigger:** Duplicate guest/company contacts exist.

**Solution:**

- Use merge flow to select canonical contact.
- Reassign reservations/bookings/invoices to canonical contact.
- Keep audit record.

**Acceptance tests:**

- Reservations move to canonical contact.
- Duplicate contact no longer appears as active.
- No orphaned reservations remain.

---

### Scenario I05 — Company contact for billing

**Trigger:** Company is selected as billing party.

**Solution:**

- Require company contact when company billing type is used.
- Store company contact in reservation company info.
- Use company details on invoice.

**Acceptance tests:**

- Company billing without company contact fails.
- Company invoice uses company name/address.
- Company details page shows related reservations/invoices.

---

### Scenario I06 — Invalid guest contact fields

**Trigger:** Guest data contains invalid email or phone.

**Solution:**

- Use shared validation utilities.
- Return field-level errors.
- Allow optional missing fields only if business rules allow.

**Acceptance tests:**

- Invalid email rejected.
- Invalid phone rejected or normalized.
- Missing required contact field rejected.

---

## J. Room management and history scenarios

### Scenario J01 — Exact room assignment

**Trigger:** Staff assigns a physical room at booking or check-in.

**Solution:**

- Store `room_id` in `reservation_rooms`.
- Validate room availability/status.
- Update room history.

**Acceptance tests:**

- Exact room assigned successfully.
- Assigned room becomes unavailable for overlapping dates.
- Room detail shows assignment.

---

### Scenario J02 — Room type only, room assigned later

**Trigger:** Reservation is created by room type without physical room.

**Solution:**

- Allow `room_type_id` without `room_id` if inventory model supports it.
- Deduct inventory by room type or defer assignment with overbooking controls.
- Require physical room before check-in if policy requires.

**Acceptance tests:**

- Reservation can be confirmed by room type.
- Check-in prompts for physical room assignment.
- Inventory count prevents oversell.

---

### Scenario J03 — Room details modal

**Trigger:** User clicks a room in availability/calendar UI.

**Solution:**

- Implement `GET /api/rooms/:id/details-with-history`.
- Return room data, current status, current/future reservations, and history.
- Use loading, error, and empty states.

**Acceptance tests:**

- Room modal opens with correct room details.
- History events are listed.
- Unauthorized role cannot see private reservation details.

---

### Scenario J04 — Room history endpoint

**Trigger:** Staff views room status/reservation history.

**Solution:**

- Implement `GET /api/rooms/[id]/history`.
- Include maintenance, blocked, occupied, cleaned, room-change, and assignment events.
- Support query parameters for date range and event type.

**Acceptance tests:**

- Room change creates history for old and new room.
- Maintenance block appears in history.
- Date filter works.

---

### Scenario J05 — Maintenance status update

**Trigger:** Admin marks room as maintenance/out of order.

**Solution:**

- Add room status update action.
- Prevent future holds/reservations during maintenance range.
- Warn if active reservation exists.
- Create room status history and audit log.

**Acceptance tests:**

- Maintenance room blocked from availability.
- Existing active reservation triggers warning/conflict.
- History records status change.

---

## K. RBAC, security, and permission scenarios

### Scenario K01 — Front desk creates and manages normal reservations

**Trigger:** Front desk user works with reservations.

**Solution:**

Allow front desk to:

```text
reservation:create
reservation:read
reservation:update_draft
reservation:confirm
reservation:check_in
reservation:check_out
reservation:add_note
reservation:record_payment, if policy allows
```

Restrict destructive/financial override actions.

**Acceptance tests:**

- Front desk can create reservation.
- Front desk can check in confirmed reservation.
- Front desk cannot bypass pricing threshold.

---

### Scenario K02 — Accountant read-only for reservations

**Trigger:** Accountant accesses reservation information.

**Solution:**

- Allow read access to reservation/payment/invoice information needed for accounting.
- Block lifecycle actions such as cancel, check-in, check-out, no-show, room change.
- Allow accounting actions such as invoice/payment according to role design.

**Acceptance tests:**

- Accountant can view reservation billing details.
- Accountant cannot cancel reservation.
- Accountant can record invoice payment only if permission exists.

---

### Scenario K03 — Manager/admin elevated actions

**Trigger:** Manager/admin performs sensitive operations.

**Solution:**

Allow elevated actions:

```text
reservation:override_pricing
reservation:override_restriction
reservation:cancel
reservation:force_room_change
reservation:manage_billing_type
reservation:view_audit
settings:rooms_manage
settings:pricing_manage
```

Require reason for sensitive actions.

**Acceptance tests:**

- Manager can approve large discount.
- Admin can manage room/pricing settings.
- Sensitive action without reason fails if reason required.

---

### Scenario K04 — Permission denied response

**Trigger:** User lacks required action permission.

**Solution:**

- Check permission before mutation.
- Return standardized `PERMISSION_DENIED`.
- Do not perform partial writes.

**Acceptance tests:**

- Unauthorized cancel returns permission error.
- No reservation status changes.
- Audit/security log captures denied attempt if enabled.

---

### Scenario K05 — Rate limiting and session verification

**Trigger:** API routes are called repeatedly or without valid session.

**Solution:**

- Reuse existing route auth/session verification/rate-limit pattern.
- Apply stricter limits to payment, confirm, login, and mutation endpoints.

**Acceptance tests:**

- Invalid token rejected.
- Excessive requests receive rate limit response.
- Valid user under limit works normally.

---

## L. Audit log scenarios

### Scenario L01 — Reservation created audit event

**Trigger:** Reservation parent record is created.

**Solution:**

Log:

```text
actor_id
reservation_id
action = reservation.created
metadata = source, dates, room_count, guest_id/company_id
```

**Acceptance tests:**

- Create reservation writes audit event.
- Audit event has actor and reservation id.

---

### Scenario L02 — Status transition audit event

**Trigger:** Reservation status changes.

**Solution:**

Log old status, new status, reason, actor, timestamp.

**Acceptance tests:**

- Confirm/check-in/check-out/cancel/no-show all create events.
- History endpoint can show these events.

---

### Scenario L03 — Room change audit event

**Trigger:** Room assignment changes.

**Solution:**

Log old room, new room, date range, reason, actor.

**Acceptance tests:**

- Room change audit has old/new room ids.
- Room history and reservation history both reflect change.

---

### Scenario L04 — Payment/refund audit event

**Trigger:** Payment or refund is recorded.

**Solution:**

Log payment id, amount, method, reference, actor, and reason for refund.

**Acceptance tests:**

- Deposit creates audit log.
- Refund creates audit log.
- Sensitive card data is not logged.

---

### Scenario L05 — Price override audit event

**Trigger:** Manual price override is applied.

**Solution:**

Log old price, new price, delta, reason, actor, approval id if applicable.

**Acceptance tests:**

- Manual override creates price audit row.
- General audit log links to reservation.
- Unauthorized failed override can be logged separately.

---

### Scenario L06 — Notes audit event

**Trigger:** Internal note is added, edited, or deleted.

**Solution:**

Log note action, visibility, actor, and reservation id. Avoid logging full sensitive note text unless policy allows.

**Acceptance tests:**

- Note creation appears in audit/history.
- Private note content is not exposed to unauthorized role.

---

## M. API contract and error scenarios

### Scenario M01 — Validation error contract

**Trigger:** Request body is invalid.

**Solution:**

Return:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid reservation payload",
    "details": {
      "fieldErrors": {}
    }
  }
}
```

**Acceptance tests:**

- Invalid payload returns 400.
- Field errors are present.
- No database mutation occurs.

---

### Scenario M02 — Not found contract

**Trigger:** Reservation, room, guest, or invoice id does not exist.

**Solution:**

Return `NOT_FOUND` with safe message.

**Acceptance tests:**

- Unknown reservation id returns 404.
- Error does not leak internal SQL details.

---

### Scenario M03 — Conflict contract

**Trigger:** Availability, hold, extension, or confirmation conflict occurs.

**Solution:**

Return `CONFLICT`, `ROOM_UNAVAILABLE`, `HOLD_CONFLICT`, or domain-specific code.

**Acceptance tests:**

- Confirm conflict returns 409.
- Conflict details are useful but safe.

---

### Scenario M04 — Idempotency contract

**Trigger:** Confirm/payment/refund request is retried.

**Solution:**

- Accept `Idempotency-Key` header or request field.
- Store request hash and result.
- Reject same key with different payload.

**Acceptance tests:**

- Same key + same body returns same result.
- Same key + different body returns idempotency error.
- No duplicate financial/reservation records.

---

## N. Testing, seed data, and verification scenarios

### Scenario N01 — Seed basic hotel data

**Trigger:** Agent needs predictable test data.

**Solution:**

Seed:

```text
users: admin, manager, front_desk, accountant
room_types: standard, deluxe, suite
rooms: several per type
contacts: individual guest, company contact
rates: standard, seasonal, company override
bookings/reservations: confirmed, draft, checked-in, cancelled
payments: deposit, full payment, refund
```

**Acceptance tests:**

- Seed script can run locally.
- Tests use deterministic IDs or lookup keys.
- Reset script cleans test data.

---

### Scenario N02 — Migration verification

**Trigger:** After applying schema changes.

**Solution:**

Run verification queries for:

```text
table existence
enum values
foreign keys
indexes
RLS enabled
policy count
RPC existence
constraint existence
```

**Acceptance tests:**

- Verification script passes locally.
- Missing policy/index fails the verification clearly.

---

### Scenario N03 — Unit tests for service logic

**Trigger:** Agent implements services.

**Solution:**

Write unit tests for:

```text
availability overlap
pricing priority
billing split
payment balance
status transitions
permission checks
validation schema
```

**Acceptance tests:**

- Unit test suite passes.
- Each state transition has allowed and rejected test.

---

### Scenario N04 — Integration tests with mocked Supabase/database

**Trigger:** Agent implements route handlers/RPC wrappers.

**Solution:**

Test service calls with mocked database responses or local Supabase.

**Acceptance tests:**

- Create reservation service handles success and DB error.
- Confirm service handles conflict.
- Payment service handles row-lock conflict/duplicate.

---

### Scenario N05 — E2E reservation happy path

**Trigger:** Full user flow needs verification.

**Solution:**

Automate:

```text
login as front desk
search availability
create held reservation
add guest
confirm reservation
record deposit
check in
check out
view invoice/history
```

**Acceptance tests:**

- E2E passes in Playwright or chosen framework.
- UI shows correct statuses throughout.

---

### Scenario N06 — E2E conflict path

**Trigger:** Two users attempt to reserve same room.

**Solution:**

Automate or simulate two sessions:

```text
session A holds room
session B tries same room/date
session B receives conflict
session A confirms
availability updates
```

**Acceptance tests:**

- Only one confirmed reservation exists.
- Conflict message appears for second user.

---

## O. UI scenarios

### Scenario O01 — Reservation list page

**Trigger:** User opens reservations/bookings page.

**Solution:**

- Load paginated reservations.
- Support filters: status, date, guest, company, room, source.
- Show empty, loading, error states.

**Acceptance tests:**

- Pagination works.
- Filters work.
- Role-limited data is respected.

---

### Scenario O02 — Reservation create wizard

**Trigger:** User creates a reservation from UI.

**Solution:**

Wizard steps:

```text
1. Dates and room search
2. Room selection / hold
3. Guest and company info
4. Pricing and billing review
5. Payment/deposit/guarantee
6. Confirm
```

**Acceptance tests:**

- User cannot skip required steps.
- Hold expiry is shown.
- Final confirmation displays confirmation number.

---

### Scenario O03 — Reservation detail page

**Trigger:** Staff opens reservation.

**Solution:**

Show:

```text
status
rooms
guests
company billing
pricing breakdown
payments/balance
invoices
notes
history/audit
available actions by role/status
```

**Acceptance tests:**

- Action buttons respect role and status.
- Payments/history load correctly.
- Sensitive info hidden when role lacks permission.

---

### Scenario O04 — Error and warning states

**Trigger:** UI receives validation/conflict/permission errors.

**Solution:**

- Show field errors beside fields.
- Show conflict warnings with next action.
- Show permission error without exposing internals.
- Use toasts for create/update/delete/save failures.

**Acceptance tests:**

- Validation errors display correctly.
- Conflict error preserves form state.
- Permission error does not crash page.

---

## P. Agent execution prompt

Use this prompt with your implementation agent:

```md
You are implementing the hotel reservation module using the existing hotel-system architecture.

Read this scenario playbook completely before coding.

Rules:
1. Implement scenarios in order: data model, availability, holds, creation, lifecycle, pricing, payments, invoices, UI, tests.
2. Reuse existing patterns for route auth, RBAC, audit logs, API response envelopes, Supabase services, pagination, i18n, and UI states.
3. Do not implement reservation creation as a simple insert. Use transactions/RPCs and re-check availability at confirmation.
4. Add or update tests for every scenario you touch.
5. Do not break existing bookings, invoice wizard, contacts, rooms, accounting, dashboard, or RBAC flows.
6. Add audit logging for every sensitive action.
7. Use idempotency keys for confirm, payment, refund, and retryable mutation endpoints.
8. Update the graph/report after code changes using `graphify update .` if this project workflow requires it.

For each scenario:
- Identify existing files to reuse.
- Implement the smallest safe change.
- Add validation and permission checks.
- Add service/RPC/database changes if needed.
- Add tests.
- Report: files changed, behavior implemented, tests run, risks.
```

---

## Q. Final acceptance checklist

The reservation module is acceptable only when all of these are true:

- [ ] A room cannot be double-booked for overlapping dates.
- [ ] Active holds block availability.
- [ ] Expired holds do not block availability.
- [ ] Confirmation re-checks availability transactionally.
- [ ] Reservation status transitions are enforced.
- [ ] Terminal statuses are protected.
- [ ] Pricing priority is deterministic.
- [ ] Pricing is locked at confirmation.
- [ ] Company billing is supported.
- [ ] Manual price override requires permission and audit.
- [ ] Deposits, payments, refunds, and balances are consistent.
- [ ] Overpayments and excessive refunds are blocked.
- [ ] Invoices use reservation charges correctly.
- [ ] Guest/company contacts link correctly.
- [ ] Room details and room history work.
- [ ] Reservation history works.
- [ ] RBAC and RLS protect all sensitive actions.
- [ ] API errors use a consistent response envelope.
- [ ] Idempotency prevents duplicate confirms/payments/refunds.
- [ ] Audit logs exist for lifecycle, room, payment, refund, pricing, invoice, and note actions.
- [ ] Seed data and verification scripts exist.
- [ ] Unit, integration, and E2E tests cover happy path and conflict path.

