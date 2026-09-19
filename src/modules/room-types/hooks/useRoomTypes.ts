'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { RoomType, CreateRoomTypeInput, UpdateRoomTypeInput } from '../types'
import * as api from '../services/roomTypeApiClient'

interface RoomTypesState {
  items: RoomType[]
  loading: boolean
  error: string | null
}

export function useRoomTypes() {
  const [state, setState] = useState<RoomTypesState>({ items: [], loading: true, error: null })
  const genRef = useRef(0)

  const load = useCallback(async () => {
    const gen = ++genRef.current
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const items = await api.fetchRoomTypes()
      if (gen !== genRef.current) return
      setState({ items, loading: false, error: null })
    } catch (error) {
      if (gen === genRef.current) {
        setState(prev => ({ ...prev, loading: false, error: error instanceof Error ? error.message : 'Failed to load room types' }))
      }
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (input: CreateRoomTypeInput) => {
    const item = await api.createRoomTypeApi(input)
    genRef.current++
    setState(prev => ({ ...prev, items: [...prev.items, item], loading: false }))
    return item
  }, [])

  const update = useCallback(async (id: string, input: UpdateRoomTypeInput) => {
    const item = await api.updateRoomTypeApi(id, input)
    genRef.current++
    setState(prev => ({ ...prev, items: prev.items.map(i => i.id === id ? item : i), loading: false }))
    return item
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.deleteRoomTypeApi(id)
    genRef.current++
    setState(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id), loading: false }))
  }, [])

  return { ...state, create, update, remove, reload: load }
}
