# Data Model — Room Click Details Modal

## API Response: `RoomDetailsWithHistory`

```typescript
type RoomDetailsWithHistory = {
  room: {
    id: string
    roomNumber: string
    roomTypeId: string
    roomTypeName: string
    floor?: string
    capacity: number
    physicalStatus: string // available | occupied | dirty | clean | inspected | maintenance | out_of_order | blocked
    housekeepingStatus?: string
    operationalStatus?: string
  }

  currentReservation?: RoomReservationSummary
  nextReservation?: RoomReservationSummary

  availability: {
    availableNow: boolean
    availableFrom?: string
    availableUntil?: string
    unavailableReason?: string
    canSelectForCurrentSearch?: boolean
    selectDisabledReason?: string
  }

  history: RoomHistoryEvent[]
  historyTotal: number // total events (for pagination)
}

type RoomReservationSummary = {
  reservationId: string
  reservationNumber: string
  bookingType: string
  status: string
  guestName?: string
  guestId?: string
  companyName?: string
  companyId?: string
  checkInDate: string
  checkOutDate: string
  checkInTime?: string
  checkOutTime?: string
  nights: number
  adults: number
  children: number
  billingParty: string
  paymentStatus: string
  balanceAmount: number
  specialRequests?: string
  holdDetails?: {
    heldByUser: string
    holdExpiryTime: string
  }
}

type RoomHistoryEvent = {
  id: string
  dateTime: string
  eventType: string // See event types below
  reservationNumber?: string
  guestName?: string
  companyName?: string
  roomStatus?: string
  reservationStatus?: string
  checkIn?: string
  checkOut?: string
  actionBy: string
  notes?: string
  isHistorical: boolean // true for cancelled/checked-out/etc.
}
```

## History Event Types

| Event Type | Source | isHistorical |
|---|---|---|
| room.assigned | audit_logs | false |
| room.changed | audit_logs | false |
| room.released | audit_logs | true |
| reservation.created | reservation_status_history | false |
| reservation.confirmed | reservation_status_history | false |
| reservation.checked_in | reservation_status_history | false |
| reservation.checked_out | reservation_status_history | true |
| reservation.cancelled | reservation_status_history | true |
| reservation.no_show | reservation_status_history | true |
| hold.created | reservation_holds | false |
| hold.expired | reservation_holds | true |
| hold.released | reservation_holds | true |
| housekeeping.cleaned | room_status_history | false |
| housekeeping.inspected | room_status_history | false |
| maintenance.started | room_status_history | false |
| maintenance.completed | room_status_history | false |
| price.overridden | audit_logs | true |
| payment.recorded | audit_logs | false |
