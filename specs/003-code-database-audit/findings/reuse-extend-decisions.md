# Reuse / Extend / Create Decisions

Each target entity has an explicit decision and rationale. Existing legacy models are reused only when they fit the target responsibility.

## 1. `reservations`

- Decision: Create/use canonical `reservations` table instead of extending legacy `bookings`.
- Evidence: legacy `bookings` has simple status and booking shape; reservation migrations already add `reservations` with booking type, source, billing party, totals, lifecycle fields, and audit metadata.
- Rationale: the target model needs multi-room stays, company billing, holds, price ledgers, lifecycle transitions, and status history. Extending `bookings` would create a wide compatibility risk.
- Risk: dual booking/reservation models can confuse reporting unless legacy migration/adapter rules are documented.

## 2. `reservation_rooms`

- Decision: Create/use `reservation_rooms`.
- Evidence: rooms exist, but no existing table models multiple room assignments per reservation with per-room dates and statuses.
- Rationale: this table is required for multi-room reservations and availability constraints.
- Risk: exclusion constraint depends on correct active status list and date semantics.

## 3. `reservation_guests`

- Decision: Create/use `reservation_guests` while reusing `guests` as master data.
- Evidence: `guests` stores guest profiles, not reservation membership or room assignment.
- Rationale: one guest can appear in many reservations and each reservation needs roles such as primary/additional and optional room attachment.
- Risk: PII handling must avoid duplicating guest profile fields into reservation docs/logs.

## 4. `reservation_company_info`

- Decision: Create/use `reservation_company_info` while reusing `contacts` for company master records.
- Evidence: contacts and company price overrides exist, but per-reservation billing terms/company snapshot is separate.
- Rationale: reservation billing can depend on company-specific terms at booking time and must survive later contact changes.
- Risk: stale snapshots are intentional but must be labeled clearly in UI/reporting.

## 5. `reservation_pricing_items`

- Decision: Create/use `reservation_pricing_items` while reusing `room_type_pricing` and `company_price_overrides` as rate sources.
- Evidence: pricing tables store rate definitions; they do not store immutable per-reservation calculated lines.
- Rationale: reservation pricing needs nightly lines, overrides, source tracking, and auditability.
- Risk: recalculation rules must protect confirmed/paid reservations from unintended price drift.

## 6. `reservation_payments`

- Decision: Create/use `reservation_payments` and integrate with accounting payments/invoices.
- Evidence: accounting payments exist, but they are invoice-centered. Reservation deposits and guarantees can exist before invoice issue.
- Rationale: reservation workflow needs deposits, guarantees, refund markers, and payment timing before final accounting documents.
- Risk: duplicate financial state if reservation payments are not reconciled with `payments`, invoices, and ledger entries.

## 7. `reservation_holds`

- Decision: Create/use `reservation_holds`.
- Evidence: no existing hold table was found.
- Rationale: temporary room reservation requires expiration, release, and availability exclusion logic before confirmation.
- Risk: expired holds must be released reliably; scheduled cleanup depends on pg_cron availability or an alternative worker.

## 8. `reservation_notes`

- Decision: Create/use `reservation_notes`.
- Evidence: generic audit logs exist, but no reservation note model exists.
- Rationale: operational notes are domain content, not just audit events. They need reservation scope and author metadata.
- Risk: notes may contain sensitive data; access and retention rules should match guest/company privacy expectations.

## 9. `reservation_status_history`

- Decision: Create/use `reservation_status_history` while keeping generic logs for admin audit.
- Evidence: logs module tracks generic events, but target workflow needs status-to-status chronology and reason/actor metadata.
- Rationale: lifecycle history is a domain invariant used for audit, troubleshooting, and workflow validation.
- Risk: every state-changing RPC/service path must write history consistently.
