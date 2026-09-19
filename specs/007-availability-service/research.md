# Research: Availability RPC / Service

**Feature**: 007-availability-service | **Phase**: 0 — Architecture Research

## Decision 1: Single RPC vs Multiple Specialized RPCs

- **Decision**: Single enhanced `get_room_availability` RPC returning all statuses, pricing, and conflicts in one result set.
- **Rationale**: The front desk needs a single "what's available?" query. Splitting into specialized RPCs (availability + pricing + conflicts) would require 3+ round trips, increasing latency and complexity. The single-query approach meets the <2s target with proper indexes.
- **Alternatives considered**:
  - Multiple RPCs (one for base availability, one for pricing, one for conflicts) — rejected for N+1 query problem.
  - Materialized view with refresh — rejected because availability is inherently real-time and dates span all reservation states.

## Decision 2: Availability Status Logic

- **Decision**: 11 availability statuses derived from a single pass over reservation data using a CTE-based overlap query and CASE expression.
- **Rationale**: All statuses can be derived from existing fields: `reservation_rooms.status`, `rooms.physical_status`, date overlap conditions, and housekeeping flags. A single query with CTEs avoids multiple scans of the reservation_rooms table.
- **Status assignment rules**:
  - `available_for_full_stay`: No overlapping reservations/holds, room is clean and not under maintenance
  - `booked`: Overlapping reservation with status IN ('held','reserved','occupied') covering full range
  - `occupied_now`: Reservation currently in 'occupied' status with date overlap
  - `reserved_in_future`: Reservation in 'held'/'reserved' status but check_in > requested end
  - `due_out_today`: Reservation in 'occupied' status with check_out = requested check_in date
  - `available_after_checkout`: Reservation ends before requested check_out date
  - `available_after_cleaning`: Room is dirty (housekeeping_status = 'dirty')
  - `partially_available`: Partial overlap that doesn't cover full requested range
  - `not_available`: Multiple overlapping reservations covering the full range
  - `blocked`: room_physical_status = 'out_of_order'
  - `maintenance`: room_physical_status = 'maintenance'
- **Alternatives considered**:
  - Separate subquery per status — rejected for poor performance with many rooms.

## Decision 3: Overlap Detection

- **Decision**: Use `reservation_rooms` as the primary overlap target with `existing.check_in_date < p_check_out_date AND existing.check_out_date > p_check_in_date`.
- **Rationale**: The reservation_rooms table is the authoritative source for room-date assignments. The overlap formula matches standard PostgreSQL range overlap logic and leverages the existing B-tree indexes on `(check_in_date, check_out_date)` and `(room_id, check_in_date, check_out_date)` from Phase 5.
- **Considerations**:
  - Need `(room_id, check_in_date, check_out_date)` index to support both the JOIN and the range condition.
  - Only reservations with status IN ('held', 'reserved', 'occupied') are considered — draft and cancelled rooms are excluded.
  - Active holds from `reservation_holds` are checked separately via LEFT JOIN with `status = 'active' AND expires_at > now()`.

## Decision 4: Pricing Integration

- **Decision**: LEFT JOIN to `company_price_overrides` inside a CTE, with fallback to `room_types.default_rate` via COALESCE.
- **Rationale**: A single LEFT JOIN avoids subquery overhead. The pricing CTE can be computed once per query and referenced in the main SELECT.
- **Pricing logic per room per night**:
  - If `p_company_id` provided AND `company_price_overrides.override_rate` exists → use override_rate
  - Otherwise → use `room_types.default_rate`
  - `totalAmount` = rate × number of nights
  - `priceSource` = 'company_override' or 'default_rate'
  - Currency from `room_types.currency` (ISO 4217, e.g. 'USD')
- **Alternatives considered**:
  - Correlated subquery per room — rejected for poor performance on large result sets.
  - Separate RPC call for pricing — rejected to keep single-query contract.

## Decision 5: Conflict Detail Collection

- **Decision**: Use a second CTE (`conflicts`) that collects overlapping reservations per room, aggregated into a JSON array via `jsonb_agg(row_to_json(...))`.
- **Rationale**: JSON aggregation in PostgreSQL is efficient and returns a well-structured nested result. The conflict CTE can join `reservations`, `guests`, and optionally `companies` to resolve names in a single pass.
- **Conflict fields per entry**: `reservationId`, `reservationNumber`, `guestName`, `companyName`, `checkInDate`, `checkOutDate`, `conflictType` (e.g. 'date_overlap', 'active_hold', 'blocked'), `message` (human-readable).

## Decision 6: Performance Approach

- **Decision**: Rely on existing B-tree indexes from Phase 5. Use `EXPLAIN ANALYZE` to verify index usage after deployment.
- **Rationale**: The Phase 5 indexes on `reservation_rooms(check_in_date, check_out_date)` and `reservation_rooms(room_id, check_in_date, check_out_date)` are sufficient for the overlap query. At 100K reservations the single-pass CTE approach should stay well under 2 seconds.
- **If performance is inadequate**: Consider a GiST index on `daterange(check_in_date, check_out_date, '[]')` for more efficient range queries. Defer this decision — only add if EXPLAIN ANALYZE shows sequential scans.

## Decision 7: Error Handling

- **Decision**: Return meaningful error messages via RAISE EXCEPTION for invalid inputs, empty result sets (not error) for no matches.
- **Rationale**: PostgreSQL RAISE provides consistent error handling. The spec explicitly requires empty result sets (not errors) for no-matching-filters scenarios.
- **Validation rules**:
  - `p_check_in_date >= p_check_out_date` → RAISE 'Check-in date must be before check-out date'
  - Stay > 90 days → RAISE 'Maximum stay is 90 days'
  - No matching rooms → Return empty JSON array (not error)

## Decision 8: Permission Guard

- **Decision**: Use `security definer` with `can_read_reservations()` guard at function top (from Phase 6).
- **Rationale**: The existing `can_read_reservations()` helper function checks `app_role` and returns a boolean. Callers without permission get a clear `42501` exception. This is consistent with the Phase 6 RLS approach and avoids duplicating role logic.
