import { createCrudApiClient } from '@/shared/crud'
import type { Room, CreateRoomInput, UpdateRoomInput } from '../types'

const roomsCrud = createCrudApiClient<Room, CreateRoomInput, UpdateRoomInput>({
  endpoint: '/api/rooms',
  defaultError: 'Failed to manage room',
  toast: { errorMessage: 'Room operation failed' },
})

export const fetchRooms = roomsCrud.list
export const getRoom = roomsCrud.getById
export const createRoomApi = roomsCrud.create
export const updateRoomApi = roomsCrud.update
export const deleteRoomApi = roomsCrud.delete
