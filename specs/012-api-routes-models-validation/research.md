# Research: API Routes, TypeScript Models, and Validation

## Existing Route Handler Pattern

**Decision**: Use `secureReadEndpoint` / `secureMutationEndpoint` wrapper pattern

**Rationale**: This is the preferred modern pattern in the codebase, used by reservations, accounting, and contacts list routes. Wrappers handle rate limiting, CSRF (mutations only), session verification, and permission checking.

```ts
// Read
export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.BOOKINGS_READ, async () => {
    return NextResponse.json({ data })
  })
}

// Mutation
export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.BOOKINGS_WRITE, async (session) => {
    const result = await someService(input, session.id)
    await logReservationAction(session, { action: '...', description: '...', target: { ... } })
    return NextResponse.json({ data: result }, { status: 201 })
  })
}
```

- `secureReadEndpoint` — rate limit at READ tier (100 req/min), authorize, no CSRF
- `secureMutationEndpoint` — rate limit at MUTATION tier (30 req/min), CSRF check, authorize
- Error responses from auth: `401` (no session), `403` (insufficient permissions)
- `VerifiedSession` contains `{ id, email, role }`

## Existing Permission Actions

**Decision**: Add granular lifecycle action permissions; reuse existing reservation-sensitive actions

**Rationale**: Current `ACTIONS` has `BOOKINGS_READ` / `BOOKINGS_WRITE` for coarse lifecycle, plus 7 sensitive reservation actions (`RESERVATION_CANCEL`, `RESERVATION_OVERRIDE_PRICE`, etc.) defined but only available to admin via catch-all. New routes need per-lifecycle-step granularity.

**Existing reservation actions** (from `actionPermissions.ts`):
- `RESERVATION_CANCEL: 'reservation:cancel'`
- `RESERVATION_OVERRIDE_PRICE: 'reservation:override_price'`
- `RESERVATION_OVERRIDE_DEPOSIT: 'reservation:override_deposit'`
- `RESERVATION_ASSIGN_DIRTY: 'reservation:assign_dirty_room'`
- `RESERVATION_FORCE_ASSIGN: 'reservation:force_assign_room'`
- `RESERVATION_REFUND: 'reservation:refund_payment'`
- `RESERVATION_COMPANY_CREDIT: 'reservation:company_credit_override'`

**Missing granular actions**: `reservation:confirm`, `reservation:check_in`, `reservation:check_out`, `reservation:no_show`, `reservation:hold`, `reservation:change_room`, `reservation:extend_stay`

**Alternatives considered**: 
- Use only `BOOKINGS_READ`/`BOOKINGS_WRITE` for all operations — rejected because FR-019 requires per-action granularity
- Use a single `RESERVATION_WRITE` action — rejected for same reason

## Existing Validation Approach

**Decision**: Extend existing manual validation functions in `validation.ts` — do NOT migrate to Zod at this time

**Rationale**: The reservation module uses hand-written `validateCreateReservation()`, `validateConfirmReservation()`, etc. that return `ValidationError[]` with `{ field, message }`. The constitution says "All form inputs and API payloads MUST be validated with Zod schemas" but the reservation module predates this requirement. Migrating validation.js to Zod would be a bigger refactor touching service internals. Instead, add new validation functions for missing operations following the existing pattern, and wrap validation results into the structured error format `{ errors: [{ path, message, code }] }` at the route handler boundary.

**Existing functions**:
- `validateCreateReservation(input: CreateReservationInput): ValidationError[]`
- `validateStatusTransition(from: ReservationStatus, to: ReservationStatus): ValidationError | null`
- `validateConfirmReservation(input: ConfirmReservationInput): ValidationError[]`
- `validatePaymentAmount(amount, totalAmount, paidAmount): ValidationError | null`

**Needs adding**: Validation for room change, guest addition, payment recording, no-show, hold creation, stay extension

## Existing Audit Service

**Decision**: Reuse `logReservationAction(session, AuditInput)` for all new route handlers

**Rationale**: The reservation-specific audit service already supports structured logging with action mapping. Route handlers call it post-mutation and pass the session and event details. No changes needed to the audit service itself.

```ts
await logReservationAction(session, {
  action: 'reservation.confirmed',
  description: `Reservation ${id} confirmed`,
  target: { reservationId: id },
})
```

## Existing Types

**Decision**: All types in `types.ts` are sufficient; no new types needed

**Rationale**: `CreateReservationInput`, `UpdateReservationInput`, `ConfirmReservationInput`, `RecordPaymentInput`, `CreateHoldInput`, `Reservation`, `ReservationRoom`, `ReservationGuest`, etc. are all already defined. The route handlers will use these existing interfaces.

## Existing Rate Limiting

**Decision**: Use existing `RateLimitTier` constants from `secureEndpoint` wrappers (no custom configuration needed)

**Rationale**: The `secureReadEndpoint` already applies `RateLimitTier.READ` (100 req/min) and `secureMutationEndpoint` applies `RateLimitTier.MUTATION` (30 req/min). This aligns with the spec FR-032 (60 req/min) — the mutation tier is stricter which is appropriate for write operations. READ tier (100 req/min) is already within spec limits.

## Existing Session Verification

**Decision**: Session verification is handled entirely by the `secureReadEndpoint` / `secureMutationEndpoint` wrappers via `authorizeRequest()`

**Rationale**: No manual session handling needed in route handlers. The wrapper handles Bearer token, cookie-based session, and role-to-permission mapping. Route handlers receive a `VerifiedSession` with the user's `id`, `email`, and `role`.

## Key Findings Summary

| Area | Approach | File(s) |
|------|----------|---------|
| Route protection | `secureReadEndpoint` / `secureMutationEndpoint` wrappers | `src/shared/secureEndpoint.ts` |
| Permissions | Add granular lifecycle actions to `ACTIONS` + assign to `FRONT_DESK` role | `src/config/actionPermissions.ts` |
| Validation | Extend existing manual `validate*()` functions in validation.ts | `src/modules/reservations/validation.ts` |
| Error format | Convert `ValidationError[]` to `{ errors: [{ path, message, code }] }` at route layer | Route handlers |
| Audit | Reuse `logReservationAction(session, AuditInput)` | `src/modules/reservations/services/auditService.ts` |
| Types | Reuse existing `types.ts` — no new types needed | `src/modules/reservations/types.ts` |
| Rate limiting | Default tiers from `secureEndpoint` wrappers | `src/shared/secureEndpoint.ts` |
| Session | Handled by `secureEndpoint` → `authorizeRequest()` chain | `src/shared/routeAuth.ts` |
