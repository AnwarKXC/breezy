'use client'

import { useCallback } from 'react'
import { useResource } from '@/shared/data/useResource'
import type { Room, CreateRoomInput, UpdateRoomInput } from '../types'
import * as api from '../services/roomsApiClient'
import { ROOMS_KEY } from './useRooms'

export function useAdminRooms() {
  const { data, error, isLoading, refresh, mutate } = useResource<Room[]>(ROOMS_KEY, api.fetchRooms)

  const create = useCallback(async (input: CreateRoomInput) => {
    const item = await api.createRoomApi(input)
    mutate((items = []) => [...items, item])
    return item
  }, [mutate])

  const update = useCallback(async (id: string, input: UpdateRoomInput) => {
    const item = await api.updateRoomApi(id, input)
    mutate((items = []) => items.map(i => i.id === id ? item : i))
    return item
  }, [mutate])

  const remove = useCallback(async (id: string) => {
    await api.deleteRoomApi(id)
    mutate((items = []) => items.filter(i => i.id !== id))
  }, [mutate])

  return { items: data ?? [], loading: isLoading, error: error?.message ?? null, create, update, remove, reload: refresh }
}
