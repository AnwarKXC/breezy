'use client'

import { useCallback } from 'react'
import { useResource } from '@/shared/data/useResource'
import type { RoomType, CreateRoomTypeInput, UpdateRoomTypeInput } from '../types'
import * as api from '../services/roomTypeApiClient'

const ROOM_TYPES_KEY = '/api/room-types'

export function useRoomTypes() {
  const { data, error, isLoading, refresh, mutate } = useResource<RoomType[]>(ROOM_TYPES_KEY, api.fetchRoomTypes)

  const create = useCallback(async (input: CreateRoomTypeInput) => {
    const item = await api.createRoomTypeApi(input)
    mutate((items = []) => [...items, item])
    return item
  }, [mutate])

  const update = useCallback(async (id: string, input: UpdateRoomTypeInput) => {
    const item = await api.updateRoomTypeApi(id, input)
    mutate((items = []) => items.map(i => i.id === id ? item : i))
    return item
  }, [mutate])

  const remove = useCallback(async (id: string) => {
    await api.deleteRoomTypeApi(id)
    mutate((items = []) => items.filter(i => i.id !== id))
  }, [mutate])

  return { items: data ?? [], loading: isLoading, error: error?.message ?? null, create, update, remove, reload: refresh }
}
