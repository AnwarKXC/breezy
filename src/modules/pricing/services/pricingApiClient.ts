import { createCrudApiClient } from '@/shared/crud'
import type { RoomTypePricing, CreatePricingInput, UpdatePricingInput } from '../types'

const pricingCrud = createCrudApiClient<RoomTypePricing, CreatePricingInput, UpdatePricingInput>({
  endpoint: '/api/pricing',
  defaultError: 'Failed to manage pricing',
})

export const fetchPricing = pricingCrud.list
export const createPricingApi = pricingCrud.create
export const updatePricingApi = pricingCrud.update
export const deletePricingApi = pricingCrud.delete
