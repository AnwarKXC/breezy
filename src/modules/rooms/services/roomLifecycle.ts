import type { RoomStatus } from '../types'

const VALID_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  available: ['cleaning', 'maintenance'],
  occupied: ['dirty'],
  maintenance: ['available'],
  cleaning: ['available'],
  dirty: ['available'],
}

export function canTransitionRoom(from: RoomStatus, to: RoomStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function getAllowedTransitions(status: RoomStatus): readonly RoomStatus[] {
  return VALID_TRANSITIONS[status] ?? []
}
