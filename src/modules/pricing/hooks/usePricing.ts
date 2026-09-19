'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RoomTypePricing, CreatePricingInput, UpdatePricingInput } from '../types'
import * as api from '../services/pricingApiClient'

export function usePricing() {
  const [items, setItems] = useState<RoomTypePricing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.fetchPricing()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (input: CreatePricingInput) => {
    const item = await api.createPricingApi(input)
    setItems(prev => [...prev, item])
    return item
  }, [])

  const update = useCallback(async (id: string, input: UpdatePricingInput) => {
    const item = await api.updatePricingApi(id, input)
    setItems(prev => prev.map(i => i.id === id ? item : i))
    return item
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.deletePricingApi(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  return { items, loading, error, create, update, remove, reload: load }
}
