'use client'

import { useCallback } from 'react'
import { useResource } from '@/shared/data/useResource'
import type { RoomTypePricing, CreatePricingInput, UpdatePricingInput } from '../types'
import * as api from '../services/pricingApiClient'

const PRICING_KEY = '/api/pricing'

export function usePricing() {
  const { data, error, isLoading, refresh, mutate } = useResource<RoomTypePricing[]>(PRICING_KEY, api.fetchPricing)

  const create = useCallback(async (input: CreatePricingInput) => {
    const item = await api.createPricingApi(input)
    mutate((items = []) => [...items, item])
    return item
  }, [mutate])

  const update = useCallback(async (id: string, input: UpdatePricingInput) => {
    const item = await api.updatePricingApi(id, input)
    mutate((items = []) => items.map(i => i.id === id ? item : i))
    return item
  }, [mutate])

  const remove = useCallback(async (id: string) => {
    await api.deletePricingApi(id)
    mutate((items = []) => items.filter(i => i.id !== id))
  }, [mutate])

  return { items: data ?? [], loading: isLoading, error: error?.message ?? null, create, update, remove, reload: refresh }
}
