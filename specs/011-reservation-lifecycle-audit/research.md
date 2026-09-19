# Research Findings: Reservation Lifecycle Services & Audit Logs

## 1. Existing Permission Patterns

**Decision**: Use `secureMutationEndpoint` with specific reservation action permissions

**Rationale**: The project already uses `secureMutationEndpoint(request, ACTIONS.XXX, handler)` for all mutation API routes. The `ACTION_PERMISSIONS` system supports role-based checking via `canPerformAction(role, action)`. Currently:
- `ACTIONS.RESERVATION_CANCEL` exists for cancellation (manager-level)
- `ACTIONS.BOOKINGS_WRITE` is used for check-in/check-out/confirm (too broad)
- Need to add new specific permissions for lifecycle actions

**New permissions to add in `actionPermissions.ts`**:
- `RESERVATION_CONFIRM: 'reservation:confirm'` — front desk + manager
- `RESERVATION_CHECK_IN: 'reservation:check_in'` — front desk + manager
- `RESERVATION_CHECK_OUT: 'reservation:check_out'` — front desk + manager
- `RESERVATION_HOLD: 'reservation:hold'` — front desk + manager
- `RESERVATION_NO_SHOW: 'reservation:no_show'` — manager only
- `RESERVATION_CHANGE_ROOM: 'reservation:change_room'` — front desk + manager
- `RESERVATION_EXTEND_STAY: 'reservation:extend_stay'` — front desk + manager
- `RESERVATION_RECORD_PAYMENT: 'reservation:record_payment'` — front desk + manager

**Existing actions already present**: `RESERVATION_CANCEL`, `RESERVATION_OVERRIDE_PRICE`, `RESERVATION_OVERRIDE_DEPOSIT`, `RESERVATION_ASSIGN_DIRTY`, `RESERVATION_FORCE_ASSIGN`, `RESERVATION_REFUND`, `RESERVATION_COMPANY_CREDIT` — all manager-level.

**FRONT_DESK_ACTIONS** and **ACCOUNTANT_ACTIONS** arrays need updating.

## 2. Existing API Route Patterns

**Decision**: Follow the `secureMutationEndpoint` pattern for all new routes

**Rationale**: Every existing API route consistently uses:
```ts
return secureMutationEndpoint(request, ACTIONS.XXX, async (session) => {
  const result = await serviceMethod(...)
  await logReservationAction(session, { action, description, target })
  return NextResponse.json(result)
})
```

New routes needed:
- `POST /api/reservations/[id]/no-show` — permission `RESERVATION_NO_SHOW`
- `POST /api/reservations/[id]/rooms` — add room (change), permission `RESERVATION_CHANGE_ROOM`
- `PATCH /api/reservations/[id]/rooms/:reservationRoomId` — update room assignment, permission `RESERVATION_CHANGE_ROOM`
- `DELETE /api/reservations/[id]/rooms/:reservationRoomId` — remove room, permission `RESERVATION_CHANGE_ROOM`
- `POST /api/reservations/[id]/extend` — extend stay, permission `RESERVATION_EXTEND_STAY`

Existing routes needing permission update:
- `POST /api/reservations/[id]/hold` — change from `BOOKINGS_WRITE` → `RESERVATION_HOLD`
- `POST /api/reservations/[id]/release-hold` — add permission check `RESERVATION_HOLD`
- `POST /api/reservations/[id]/confirm` — change from `BOOKINGS_WRITE` → `RESERVATION_CONFIRM`
- `POST /api/reservations/[id]/check-in` — change from `BOOKINGS_WRITE` → `RESERVATION_CHECK_IN`
- `POST /api/reservations/[id]/check-out` — change from `BOOKINGS_WRITE` → `RESERVATION_CHECK_OUT`
- `POST /api/reservations/[id]/payments` — add permission check `RESERVATION_RECORD_PAYMENT`

## 3. Audit Log Table Structure

**Existing schema**: The `audit_logs` table already exists with columns: `action`, `module`, `description`, `actor` (jsonb), `target` (jsonb), `metadata` (jsonb), `created_at`.

**Issues**:
- No `created_at` index for efficient querying by date range
- No retention/purge mechanism
- `logReservationAction` silently catches errors — does not propagate

**Changes needed**:
- Add `idx_audit_logs_created_at` index for query performance
- Add `idx_audit_logs_module_action` index for filtering
- Modify `logReservationAction` to throw errors instead of silently catching
- Add migration for audit log index and retention support

## 4. Existing Supabase RPCs

**`confirm_reservation(p_reservation_id, p_user_id)`**: Exists but needs inspection of its internal logic for:
- Hold revalidation (FR-008)
- Availability conflict recheck (FR-003)
- Status history insertion
- Price validation

**`cancel_reservation(p_reservation_id, p_reason, p_user_id)`**: Exists, likely handles:
- Status update to `cancelled`
- Room release (setting reservation_rooms status to `released`)
- Status history insertion

**Need to verify**: Whether these RPCs handle hold revalidation or if that logic needs to be added in the service layer before calling the RPC.

## 5. Reservation Room Overlap / Exclusion Constraint

**Decision**: Conflict prevention currently relies on the RPC logic, not a database exclusion constraint.

**Rationale**: The existing `reservation_rooms` table does not appear to have a GiST exclusion constraint (need to verify via Supabase MCP). The spec allows either approach. Given existing patterns, the service-level + RPC approach is sufficient with proper transactional locking.

## 6. Existing Service Method Coverage

| Method | Exists | Needs Permission Check | Needs Audit Integration |
|--------|--------|----------------------|------------------------|
| createReservationDraft | ✅ | ✅ (add) | ✅ (add audit) |
| updateReservationDraft | ✅ | ✅ (add) | ✅ (add audit) |
| createHold | ✅ | ✅ (add) | ✅ (add audit) |
| releaseHold | ✅ | ✅ (add) | ✅ (add audit) |
| confirmReservation | ✅ | ✅ (change: BOOKINGS_WRITE → RESERVATION_CONFIRM) | ✅ (add transactional audit) |
| cancelReservation | ✅ | ✅ (already has RESERVATION_CANCEL) | ✅ (add transactional audit) |
| checkInReservation | ✅ | ✅ (change: none → RESERVATION_CHECK_IN) | ✅ (add transactional audit) |
| checkOutReservation | ✅ | ✅ (change: none → RESERVATION_CHECK_OUT) | ✅ (add transactional audit) |
| markNoShow | ✅ (service) | ✅ (add) | ✅ (add audit) |
| recordPayment | ✅ | ✅ (add) | ✅ (add audit) |
| changeReservationRoom | ❌ (new) | N/A | ✅ (add audit) |
| extendReservationStay | ❌ (new) | N/A | ✅ (add audit) |
| recalculateReservationPricing | ✅ (stub) | N/A | N/A (stub) |

## 7. Hold Expiry Cleanup

**Decision**: Implement as an inline check during availability queries and as a Supabase cron job.

**Rationale**: The spec says "scheduled job or inline check." The most reliable approach is both:
1. Inline: During `getRoomAvailability`, expire any holds past their `expires_at`
2. Scheduled: Supabase cron job runs every 5 minutes to expire stale holds

**Migration needed**: Add index on `reservation_holds(expires_at, status)` for cleanup performance.
