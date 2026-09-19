import { useState, useEffect, useCallback, useRef } from 'react'
import type { Room, CreateRoomInput, UpdateRoomInput } from '../types'
import * as api from '../services/roomsApiClient'

export function useAdminRooms() {
  const [items, setItems] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const genRef = useRef(0)

  const load = useCallback(async () => {
    const gen = ++genRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await api.fetchRooms()
      if (gen !== genRef.current) return
      setItems(data)
    } catch (err) {
      if (gen === genRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load rooms')
      }
    } finally {
      if (gen === genRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (input: CreateRoomInput) => {
    const item = await api.createRoomApi(input)
    genRef.current++
    setItems(prev => [...prev, item])
    setLoading(false)
    return item
  }, [])

  const update = useCallback(async (id: string, input: UpdateRoomInput) => {
    const item = await api.updateRoomApi(id, input)
    genRef.current++
    setItems(prev => prev.map(i => i.id === id ? item : i))
    setLoading(false)
    return item
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.deleteRoomApi(id)
    genRef.current++
    setItems(prev => prev.filter(i => i.id !== id))
    setLoading(false)
  }, [])

  return { items, loading, error, create, update, remove, reload: load }
}
