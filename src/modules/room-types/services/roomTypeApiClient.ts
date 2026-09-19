import { createCrudApiClient } from '@/shared/crud'
import type { RoomType, CreateRoomTypeInput, UpdateRoomTypeInput } from '../types'

const roomTypesCrud = createCrudApiClient<RoomType, CreateRoomTypeInput, UpdateRoomTypeInput>({
  endpoint: '/api/room-types',
  defaultError: 'Failed to manage room type',
})

export const fetchRoomTypes = roomTypesCrud.list
export const getRoomType = roomTypesCrud.getById
export const createRoomTypeApi = roomTypesCrud.create
export const updateRoomTypeApi = roomTypesCrud.update
export const deleteRoomTypeApi = roomTypesCrud.delete
