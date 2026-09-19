import type { YearOverviewRoom, YearOverviewRoomType } from '../types'

/** Natural-number order so 2 comes before 10. */
export function compareRoomNumber(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export interface RoomColumnGroup {
  typeId: string
  name: string
  rooms: YearOverviewRoom[]
}

/**
 * Columns ordered strictly by room number. The room-type header spans each run of
 * consecutive same-type rooms, so a type appears more than once when its rooms are
 * not contiguous in numeric order.
 */
export function buildRoomColumns(rooms: YearOverviewRoom[], roomTypes: YearOverviewRoomType[]) {
  const typeNameById = new Map(roomTypes.map((roomType) => [roomType.id, roomType.name]))
  const orderedRooms = [...rooms].sort((a, b) => compareRoomNumber(a.number, b.number))
  const groups: RoomColumnGroup[] = []

  for (const room of orderedRooms) {
    const last = groups[groups.length - 1]
    if (last && last.typeId === room.typeId) {
      last.rooms.push(room)
      continue
    }
    groups.push({ typeId: room.typeId, name: typeNameById.get(room.typeId) ?? '', rooms: [room] })
  }

  return { orderedRooms, groups, typeNameById }
}
