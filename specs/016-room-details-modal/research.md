# Research: Room Click Details Modal & Final Acceptance

## Existing Component Patterns

**Decision**: Model the RoomDetailsModal after the existing `InvoiceModal` component in `src/modules/accounting/components/InvoiceModal.tsx`.

**Rationale**: The project already has modal components (InvoiceModal, ContactCard) using Tailwind CSS with consistent layout patterns (header, body sections, footer). The room details modal follows the same overlay + card pattern with `fixed inset-0 z-50` and scrollable content.

**Alternatives considered**: Page-based navigation — rejected because modal overlays preserve the user's current view context (availability board, calendar).

## Data Fetching Pattern

**Decision**: Single API endpoint `GET /api/rooms/[id]/details-with-history` that returns a combined `RoomDetailsWithHistory` response. The hook `useRoomDetails` calls this endpoint when modal opens.

**Rationale**: The constitution requires data flow: UI → Hook → Service → Supabase. A single endpoint prevents N+1 requests and keeps the modal opening fast (<1s). The response shape follows the plan-documented `RoomDetailsWithHistory` type.

**Existing pattern reference**: Contacts module uses `useContactForm` hook via RTK query. The room details hook can use a simpler `useState` + `useEffect` or RTK query pattern — both exist in the codebase.

## Room History Data Sources

**Decision**: Combine events from `reservation_status_history`, `room_status_history`, `reservation_holds`, `reservation_notes`, and `audit_logs` into a single timeline via the service layer.

**Rationale**: No new data tables needed. The existing tables already track all required events. The service computes a unified timeline view in TypeScript (not a SQL view, to stay in the service layer per constitution).

**Event sources mapping**:

| Event Type | Source Table | Filter |
|---|---|---|
| reservation.created/confirmed/checked_in/checked_out/cancelled | `reservation_status_history` | `reservation_id` linked to room |
| room.assigned/changed/released | `audit_logs` | `action` + `target_type = 'reservation_room'` |
| hold.created/expired/released | `reservation_holds` + `audit_logs` | `room_id` |
| housekeeping.cleaned/inspected | `room_status_history` | `to_status IN ('clean','inspected')` |
| maintenance.started/completed | `room_status_history` | `to_status IN ('maintenance','available')` |
| price.overridden | `audit_logs` | `action = 'price_override'` |

## Performance Strategy

**Decision**: History table loaded with a `LIMIT 100` default, paginated via cursor or offset.

**Rationale**: Rooms with thousands of events (long-running hotel) could overwhelm the UI. FR-016 requires pagination or date-range filtering. LIMIT 100 is a safe default per SC-002 (<2s for 500 events).

## RTL/Accessibility

**Decision**: Modal uses existing i18n infrastructure (`useTranslation()`) for all labels. Right-to-left layout for Arabic via Tailwind RTL variants.

**Rationale**: Constitution Gate V requires Arabic RTL + English LTR support. All text must go through translation keys per Gate III.

## Acceptance Criteria Verification

**Decision**: Create a verification checklist document at `specs/016-room-details-modal/acceptance-checklist.md` that maps the 26 acceptance criteria to verifiable queries and demonstration steps.

**Rationale**: The spec's US3 requires verifying all 26 acceptance criteria. A checklist document provides structured traceability. Each criterion can be verified via MCP queries (schema/data integrity) or UI demonstration (modal behavior).
