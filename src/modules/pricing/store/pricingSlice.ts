import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { RoomTypePricing, CreatePricingInput, UpdatePricingInput } from '../types'
import * as api from '../services/pricingApiClient'

interface PricingState {
  items: RoomTypePricing[]
  loading: boolean
  error: string | null
}

const initialState: PricingState = {
  items: [],
  loading: false,
  error: null,
}

export const fetchPricingData = createAsyncThunk('pricing/fetchAll', async () => {
  return await api.fetchPricing()
})

export const createPricingThunk = createAsyncThunk(
  'pricing/create',
  async (input: CreatePricingInput) => await api.createPricingApi(input)
)

export const updatePricingThunk = createAsyncThunk(
  'pricing/update',
  async ({ id, input }: { id: string; input: UpdatePricingInput }) => await api.updatePricingApi(id, input)
)

export const deletePricingThunk = createAsyncThunk(
  'pricing/delete',
  async (id: string) => { await api.deletePricingApi(id); return id }
)

const pricingSlice = createSlice({
  name: 'pricing',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPricingData.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchPricingData.fulfilled, (state, action) => { state.loading = false; state.items = action.payload })
      .addCase(fetchPricingData.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load' })
      .addCase(createPricingThunk.fulfilled, (state, action) => { state.items.push(action.payload) })
      .addCase(updatePricingThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex(i => i.id === action.payload.id)
        if (idx >= 0) state.items[idx] = action.payload
      })
      .addCase(deletePricingThunk.fulfilled, (state, action) => {
        state.items = state.items.filter(i => i.id !== action.payload)
      })
  },
})

export default pricingSlice.reducer
