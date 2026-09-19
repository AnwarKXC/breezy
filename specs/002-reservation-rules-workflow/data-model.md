# Domain Model Reference: Reservation Rules and Workflow

## 1. Reservation Lifecycle Statuses

### Status Enum

```typescript
type ReservationStatus =
  | 'draft'
  | 'held'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show'
  | 'expired';
```

### Status Transition Map

```
Primary flow:
  draft → held → confirmed → checked_in → checked_out

Alternative flows:
  draft → cancelled
  held → expired
  held → cancelled
  confirmed → cancelled
  confirmed → no_show
```

### Transition Rules

| From | To | Allowed? | Condition |
|------|----|----------|-----------|
| draft | held | ✅ | |
| draft | confirmed | ✅ | |
| draft | cancelled | ✅ | |
| held | confirmed | ✅ | Hold must not be expired |
| held | expired | ✅ | Automatic via cron |
| held | cancelled | ✅ | |
| confirmed | checked_in | ✅ | Room must be ready |
| confirmed | cancelled | ✅ | |
| confirmed | no_show | ✅ | Follows hotel policy |
| checked_in | checked_out | ✅ | |
| checked_out | (any) | ❌ | Terminal state |
| cancelled | (any) | ❌ | Terminal state |
| no_show | (any) | ❌ | Terminal state |
| expired | (any) | ❌ | Terminal state |

### Business Rules

- Only `confirmed` reservations can check in.
- Only `checked_in` reservations can check out.
- `cancelled` reservations release all assigned rooms.
- `expired` holds release rooms.
- `checked_out` reservations are historical and do not block future availability.
- `no_show` billing: guest charged for first night only (from clarification Q3).

---

## 2. Reservation Booking Types

| Type | Description | Billing Default |
|------|-------------|-----------------|
| `individual` | Single guest or family booking | Guest pays |
| `company` | Company books for employees; company is payer | Company pays via invoice/credit |
| `group` | Group booking (tour group, event) with multiple rooms | Group leader or organizer pays |
| `travel_agent` | Booking made through a travel agency | Agency pays (commission) |
| `internal` | Internal/staff booking (complimentary or reduced) | Internal/complimentary |

### Booking Type Rules

- **Individual**: Must have one primary guest. Room assigned at creation or check-in.
- **Company**: Company is the billing party. Guest names may be pending. Company rate override applies automatically.
- **Group**: Multiple rooms under one reservation. Guest names can be added later.
- **Travel Agent**: May have commission tracking. Billing is between hotel and agency.
- **Internal**: Staff or complimentary bookings. May use special rate codes.

---

## 3. Billing Parties

| Party | Payer | When Used |
|-------|-------|-----------|
| `guest` | The sleeping guest | Individual reservations |
| `company` | The company entity | Company reservations |
| `split` | Multiple parties | Guest pays room charges, company pays incidentals |
| `complimentary` | No charge | VIP, staff, promotional |

### Billing Rules

- `company` billing ≠ `company` booking type — an individual can also use company billing if the company agrees to pay.
- `split` billing requires clear tracking of which charges go to each party.
- `complimentary` still records pricing for reporting purposes (original rate tracked, applied rate = 0).
- Billing party can be changed after creation with proper audit trail.

---

## 4. Room Assignment Statuses

Status of the reservation-to-room relationship — tracked independently from reservation lifecycle.

### Status Enum

```typescript
type RoomAssignmentStatus =
  | 'selected'      // Room picked but not yet held
  | 'held'          // Temporarily blocked by hold
  | 'reserved'      // Confirmed reservation
  | 'occupied'      // Guest checked in
  | 'checked_out'   // Guest checked out (room released)
  | 'cancelled'     // Room unassigned due to cancellation
  | 'released';     // Room freed (hold expired or released)
```

### Assignment Lifecycle

```
Primary flow (individual):
  selected → reserved → occupied → checked_out

With hold:
  selected → held → reserved → occupied → checked_out

Cancellation:
  reserved → cancelled
  held → cancelled

Release:
  held → released  (expired hold)
```

### Key Distinction

Room assignment status tracks **the room's relationship to a reservation**. This is distinct from:
- **Reservation lifecycle status** (draft, confirmed, checked_in, etc.) — the reservation's overall state
- **Physical room status** (available, dirty, clean, maintenance) — the room's operational state

---

## 5. Physical Room Statuses

Operational state of the room — tracked independently from both reservation lifecycle and room assignment.

### Status Enum

```typescript
type PhysicalRoomStatus =
  | 'available'         // Ready for new reservation
  | 'occupied'          // Guest currently in room
  | 'dirty'             // Checked out, needs cleaning
  | 'clean'             // Cleaned, ready for inspection
  | 'inspected'         // Passed quality inspection
  | 'maintenance'       // Under repair
  | 'out_of_order'      // Not serviceable
  | 'blocked'           // Held for VIP, out of inventory temporarily
  | 'reserved_future'   // Reserved for future date, currently available
  | 'due_out'           // Guest checking out today
  | 'due_in';            // Guest arriving today
```

### Status Transitions

```
available → occupied       (check-in)
occupied → dirty            (check-out)
dirty → clean               (housekeeping cleans)
clean → inspected           (supervisor inspects)
inspected → available       (ready for next guest)
available → maintenance     (issue reported)
maintenance → available     (repair completed)
available → blocked         (administrative hold)
blocked → available         (hold released)
available → out_of_order    (major issue)
out_of_order → available    (restored after repair)
```

### Independence Rule

Physical room status changes do NOT automatically change reservation status. Examples:
- A room can be `dirty` while its reservation is `checked_out` — these are separate states.
- A room can be `maintenance` but its reservation is `confirmed` for future dates — the reservation is not cancelled.
- Housekeeping staff changes room status without touching reservation data.

---

## 6. Entity Relationship Overview

```
Reservation (extends bookings)
  │
  ├── ReservationRoom (1..N) — room assignments with per-room pricing
  │     ├── ReservationGuest (0..N) — guests assigned to specific room
  │     └── ReservationPricingItem (1..N) — per-room price lines
  │
  ├── ReservationGuest (0..N) — guests not yet assigned to a room
  ├── ReservationCompanyInfo (0..1) — company billing (when booking_type=company)
  ├── ReservationPricingItem (0..N) — reservation-level pricing (service charges, etc.)
  ├── ReservationPayment (0..N) — payments recorded against reservation
  ├── ReservationHold (0..N) — active/expired holds for rooms
  ├── ReservationNote (0..N) — operational notes
  └── ReservationStatusHistory (1..N) — lifecycle audit trail

Room
  └── RoomStatusHistory (0..N) — physical room status changes
```
