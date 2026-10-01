// Returned by the get_sql_schema tool only when the model needs ad-hoc SQL, so
// ordinary questions never pay for these tokens. Keep in sync with migration
// 20261002130000_ai_readonly_sql.
export function aiSqlSchemaDoc(today: string): string {
  const yearStart = `${today.slice(0, 4)}-01-01`
  return `PostgreSQL 17, read-only. Query ONLY these views (write ai.<view>). Soft-deleted rows are already excluded.

ai.reservations(id, reservation_number, status, source, booking_type, billing_party, check_in_date DATE, check_out_date DATE, nights, adults, children, infants, room_count, primary_guest_id→guests.id, company_id→contacts.id, booker_name, currency, subtotal_amount, discount_amount, tax_amount, service_amount, total_amount, paid_amount, balance_amount, created_at, cancelled_at, checked_in_at, checked_out_at)
  status: draft|held|confirmed|checked_in|checked_out|cancelled|no_show|expired. "Real" stays = confirmed, checked_in, checked_out.
  source: walk_in|phone|website|whatsapp|email|company|travel_agent|ota|manual. booking_type: individual|company|group|travel_agent|internal.
ai.reservation_rooms(id, reservation_id, room_id→rooms.id, room_type_id→room_types.id, check_in_date, check_out_date, nights, status, adults, children, rate_per_night, total_amount, price_source, currency)
  One row per booked room. status: held|reserved|occupied|checked_out|cancelled|released|selected. total_amount = room revenue before tax.
ai.reservation_guests(reservation_id, guest_id→guests.id, contact_id, full_name, role, nationality, is_primary, is_vip, reservation_room_id)
ai.rooms(id, number, floor, room_type_id, capacity, occupancy_status vacant|occupied, housekeeping_status clean|dirty|cleaning|inspected, operational_status active|maintenance|out_of_order|blocked)
ai.room_types(id, name, default_capacity)
ai.guests(id, first_name, last_name, full_name, phone, email, country ISO2, status active|inactive|vip|blacklist, created_at)
ai.contacts(id, type company|individual, name, phone, email, country, city, created_at)  -- companies = type 'company'
ai.invoices(id, invoice_number, contact_id→contacts.id, reservation_id, status, currency, amount (total), subtotal, discount, tax_amount, service_charge, paid_amount, refunded_amount, remaining_balance, issue_date DATE, due_date DATE, paid_at, payment_method, guest_name, company_name, room_number)
  status: draft|issued|partially_paid|partially_refunded|paid|overdue|void|refunded.
ai.payments(id, invoice_id→invoices.id, method, amount, currency, transaction_date DATE, created_at)
  Refunds are NEGATIVE amounts. method: cash|visa|card|instapay|vodafone_cash|bank_transfer|online|ota|company_credit|other.
ai.expenses(id, category_id→expense_categories.id, date DATE, status draft|approved|paid|void, vendor, payment_method, description, amount, currency)
ai.expense_categories(id, name, name_ar)

Business rules (must follow):
- Money: NEVER add amounts of different currencies. Always GROUP BY currency (or filter one currency) when summing money, and select the currency column.
- Invoiced revenue = SUM(invoices.amount) WHERE status NOT IN ('draft','void'), dated by issue_date.
- Collected = SUM(payments.amount) dated by transaction_date (refunds included as negatives).
- Outstanding = SUM(invoices.remaining_balance) WHERE status IN ('issued','partially_paid','overdue').
- Expenses normally exclude status 'draft' and 'void'.
- A stay "in a period" overlaps it: check_in_date <= period_end AND check_out_date > period_start.
- Dates: write literals from today's date in the context, e.g. DATE '${today}'; interval arithmetic is fine. Do not use now()/current_date for "today".
- Arabic/any name search: ai.normalize_ar(column) LIKE '%' || ai.normalize_ar('text') || '%'.
- Return few, meaningful columns with readable aliases (snake_case). Aggregate in SQL; at most 200 rows come back. Add ORDER BY.

Examples:
-- Guests who stayed more than 3 times this year and still owe money
WITH stays AS (SELECT primary_guest_id, count(*) AS stays FROM ai.reservations WHERE status IN ('confirmed','checked_in','checked_out') AND check_in_date >= DATE '${yearStart}' GROUP BY primary_guest_id HAVING count(*) > 3)
SELECT g.full_name, s.stays, r.currency, sum(r.balance_amount) AS balance FROM stays s JOIN ai.guests g ON g.id = s.primary_guest_id JOIN ai.reservations r ON r.primary_guest_id = s.primary_guest_id WHERE r.balance_amount > 0 GROUP BY g.full_name, s.stays, r.currency ORDER BY balance DESC
-- Average stay length and booked value by weekday of arrival, last 90 days
SELECT to_char(check_in_date, 'Day') AS weekday, count(*) AS reservations, round(avg(nights), 1) AS avg_nights, currency, sum(total_amount) AS booked_value FROM ai.reservations WHERE status IN ('confirmed','checked_in','checked_out') AND check_in_date >= DATE '${today}' - 90 GROUP BY 1, currency ORDER BY reservations DESC`
}
