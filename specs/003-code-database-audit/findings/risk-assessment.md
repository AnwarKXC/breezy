# Risk Assessment

## High Risks

- Live database not verified in this session. Supabase MCP was not exposed and `supabase` CLI was unavailable, so findings are based on migrations and generated types only.
- Legacy `bookings` and canonical `reservations` coexist. Without migration/reporting rules, staff and reports may use different sources of truth.
- `reservation_payments` and accounting `payments`/invoices can diverge. A reconciliation or handoff rule is required before production finance use.
- RLS and service-role boundaries need live verification. High-risk actions include overrides, forced assignment, refunds, company credit, and payment recording.

## Medium Risks

- Room state vocabulary mismatch: app room status uses `cleaning`, while reservation schema introduces physical status concepts such as dirty. UI, availability, and housekeeping workflows need one shared mapping.
- Expired hold cleanup depends on pg_cron or equivalent worker availability. If cleanup does not run, availability can be blocked by stale holds.
- Generic logs and `reservation_status_history` can drift if state-changing paths do not write both expected audit records.
- Guests and contacts contain PII. Notes, logs, and findings should not copy row data or sensitive fields beyond schema names.
- No `/api/bookings` route exists, while legacy booking hooks/services remain. Any legacy UI still using bookings may rely on older service paths.

## Low Risks

- Several legacy hooks use older root service imports and hardcoded toast strings. This is not a blocker for the audit but may affect consistency.
- Generated database types include the reservation schema, but type drift can recur if migrations are applied without regeneration.
- Current repository lint/test health includes unrelated failures from existing suites, so validation for this audit should focus on document completeness unless source changes are requested.

## Mitigations

- Run a live Supabase schema/RLS audit when MCP or CLI credentials are available.
- Publish a clear source-of-truth decision: reservations for new workflow, bookings for legacy/archive only.
- Add payment reconciliation tests around deposits, invoice issue, refund, and ledger output.
- Add a room-status mapping contract shared by room services, reservation availability, and UI.
- Keep audit deliverables schema-level only; do not include guest/contact row data.
