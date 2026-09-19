'use client'

import { useCallback } from 'react'
import { roomService } from '@/services/roomService'
import { useResource } from '@/shared/data/useResource'
import { toast } from '@/shared/toast/toastEvents'
import type { Room } from '../types'

export const ROOMS_KEY = '/api/rooms'
const AVAILABLE_ROOMS_KEY = '/api/rooms?status=available'

function reportLoadError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'Failed to fetch rooms'
  toast.error('Network error', { description: message })
  throw error
}

const fetchAllRooms = () => roomService.getAll().catch(reportLoadError)
const fetchAvailableRooms = () => roomService.getAvailable().catch(reportLoadError)

export function useRooms({ filterAvailable = false }: { filterAvailable?: boolean } = {}) {
  const { data, error, isLoading, refresh, mutate } = useResource<Room[]>(
    filterAvailable ? AVAILABLE_ROOMS_KEY : ROOMS_KEY,
    filterAvailable ? fetchAvailableRooms : fetchAllRooms,
  )

  const run = useCallback(async <T,>(action: () => Promise<T>, fallback: T, failure: string): Promise<T> => {
    try {
      return await action()
    } catch (e) {
      toast.error('Operation failed', { description: e instanceof Error ? e.message : failure })
      return fallback
    }
  }, [])

  const createRoom = useCallback((room: Omit<Room, 'id'>) => run(async () => {
    const created = await roomService.create(room)
    mutate((rooms = []) => [...rooms, created])
    toast.success('Operation completed')
    return created
  }, null, 'Failed to create room'), [mutate, run])

  const updateRoom = useCallback((id: string, patch: Partial<Room>) => run(async () => {
    const updated = await roomService.update(id, patch)
    if (!updated) throw new Error('Failed to update room')
    mutate((rooms = []) => rooms.map(r => (r.id === id ? updated : r)))
    toast.success('Operation completed')
    return updated
  }, null, 'Failed to update room'), [mutate, run])

  const deleteRoom = useCallback((id: string) => run(async () => {
    if (!(await roomService.delete(id))) throw new Error('Failed to delete room')
    mutate((rooms = []) => rooms.filter(r => r.id !== id))
    toast.success('Operation completed')
    return true
  }, false, 'Failed to delete room'), [mutate, run])

  return {
    rooms: data ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    fetchRooms: refresh,
    createRoom,
    updateRoom,
    deleteRoom,
  }
}

export default useRooms
