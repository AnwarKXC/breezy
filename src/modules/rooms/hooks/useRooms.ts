import { useState, useEffect, useCallback } from 'react'
import { roomService } from '@/services/roomService'
import type { Room } from '../types'
import { toast } from '@/shared/toast/toastEvents'
import * as api from '../services/roomsApiClient'
import type { CreateRoomInput, UpdateRoomInput } from '../types'

interface UseRoomsOptions {
  autoFetch?: boolean
  filterAvailable?: boolean
}

export function useRooms(options: UseRoomsOptions = {}) {
  const { autoFetch = true, filterAvailable = false } = options

  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = filterAvailable 
        ? await roomService.getAvailable()
        : await roomService.getAll()
      setRooms(data)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch rooms'
      setError(message)
      toast.error('Network error', { description: message })
    } finally {
      setLoading(false)
    }
  }, [filterAvailable])

  const createRoom = useCallback(async (data: Omit<Room, 'id'>) => {
    setLoading(true)
    setError(null)
    try {
      const created = await roomService.create(data)
      setRooms(prev => [...prev, created])
      toast.success('Operation completed')
      return created
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create room'
      setError(message)
      toast.error('Operation failed', { description: message })
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const updateRoom = useCallback(async (id: string, data: Partial<Room>) => {
    setLoading(true)
    setError(null)
    try {
      const updated = await roomService.update(id, data)
      if (updated) {
        setRooms(prev => prev.map(r => (r.id === id ? updated : r)))
        toast.success('Operation completed')
      } else {
        toast.error('Operation failed', { description: 'Failed to update room' })
      }
      return updated
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update room'
      setError(message)
      toast.error('Operation failed', { description: message })
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteRoom = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const success = await roomService.delete(id)
      if (success) {
        setRooms(prev => prev.filter(r => r.id !== id))
        toast.success('Operation completed')
      } else {
        toast.error('Operation failed', { description: 'Failed to delete room' })
      }
      return success
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete room'
      setError(message)
      toast.error('Operation failed', { description: message })
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!autoFetch) return

    const timer = setTimeout(() => void fetchRooms(), 0)
    return () => clearTimeout(timer)
  }, [autoFetch, fetchRooms])

  return {
    rooms,
    loading,
    error,
    fetchRooms,
    createRoom,
    updateRoom,
    deleteRoom,
  }
}

export default useRooms
