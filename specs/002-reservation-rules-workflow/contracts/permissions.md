# Contract: Permission Actions by Role

## Purpose

All write operations MUST verify the user session and action permission before executing. This contract defines the required permission actions and their mapping to existing roles.

## Required Actions

```typescript
type ReservationAction =
  | 'reservation:create'
  | 'reservation:read'
  | 'reservation:update'
  | 'reservation:confirm'
  | 'reservation:cancel'
  | 'reservation:check_in'
  | 'reservation:check_out'
  | 'reservation:override_price'
  | 'reservation:override_deposit'
  | 'reservation:force_assign_room'
  | 'reservation:assign_dirty_room'
  | 'reservation:assign_maintenance_room'
  | 'reservation:company_credit_override'
  | 'reservation:record_payment'
  | 'reservation:refund_payment';
```

## Role-to-Action Mapping

### Front Desk

```typescript
const FRONT_DESK_ACTIONS: ReservationAction[] = [
  'reservation:create',
  'reservation:read',
  'reservation:update',
  'reservation:confirm',
  'reservation:check_in',
  'reservation:check_out',
  'reservation:record_payment',
];
```

### Manager / Admin

```typescript
const ADMIN_ACTIONS: ReservationAction[] = [
  ...FRONT_DESK_ACTIONS,
  'reservation:cancel',
  'reservation:override_price',
  'reservation:override_deposit',
  'reservation:force_assign_room',
  'reservation:assign_dirty_room',
  'reservation:assign_maintenance_room',
  'reservation:company_credit_override',
  'reservation:refund_payment',
];
```

### Accountant (Read-only for reservations)

```typescript
const ACCOUNTANT_ACTIONS: ReservationAction[] = [
  'reservation:read',
];
```

## Existing Integration Points

| File | Purpose |
|------|---------|
| `src/config/actionPermissions.ts` | Define `ACTIONS.RESERVATION_*` constants and `ROLE_PERMISSIONS` maps |
| `src/config/permissions.ts` | Module-level access: `RESERVATIONS` module for admin/accountant/front_desk |
| `src/config/access.ts` | `canPerformAction(role, action)` and `assertPermission(role, action)` |

## Current State (from research)

- `BOOKINGS_READ = 'bookings:read'` and `BOOKINGS_WRITE = 'bookings:write'` exist in `actionPermissions.ts`
- `RESERVATION_CANCEL` is referenced in `src/app/api/reservations/[id]/cancel/route.ts` but NOT defined in `actionPermissions.ts` (bug)
- New actions `reservation:*` must be added alongside or replacing the legacy `bookings:*` patterns
