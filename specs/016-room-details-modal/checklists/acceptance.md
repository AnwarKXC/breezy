# Room Details Modal — Acceptance Checklist

## Functional
- [ ] Clicking a room in the availability board opens the modal with the correct room ID.
- [ ] Modal title displays the room number once loaded.
- [ ] Loading state renders while fetching.
- [ ] Error state renders if the API returns 4xx/5xx.
- [ ] Modal closes via the close button and the Escape key.
- [ ] API rejects invalid UUID room IDs with HTTP 400.
- [ ] API returns 404 when the room does not exist or is soft-deleted.
- [ ] API requires `rooms:read` permission; otherwise returns 401/403.

## Data Display
- [ ] Room header shows room number, room type, and physical status.
- [ ] Room status card shows floor, capacity, housekeeping status, and any maintenance/blocking reason.
- [ ] Current reservation card shows guest name, dates, and reservation status.
- [ ] Next reservation card shows guest name, dates, and reservation status.
- [ ] When no current or next reservation, the card shows an empty-state message.
- [ ] Availability card shows whether the room is available tonight and the next available date.

## History
- [ ] History table combines reservation events from the reservations list and audit/housekeeping/maintenance events from the history rows.
- [ ] Events are sorted by timestamp descending (newest first).
- [ ] History total count is displayed in the table header.
- [ ] Empty history renders an empty-state message.

## Non-functional
- [ ] Modal content is scrollable when it exceeds viewport height.
- [ ] Components are memoized where appropriate to avoid unnecessary re-renders.
- [ ] No `console.log` statements in production code paths.
- [ ] TypeScript `tsc --noEmit` passes.
- [ ] ESLint passes for all new and modified files.
- [ ] `next build` completes without errors.

## E2E
- [ ] E2E spec opens the modal for an occupied room and verifies current reservation details.
- [ ] E2E spec verifies room status and availability cards are visible.
