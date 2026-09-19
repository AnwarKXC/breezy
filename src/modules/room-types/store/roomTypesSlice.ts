import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { RoomType, CreateRoomTypeInput, UpdateRoomTypeInput } from '../types'
import * as api from '../services/roomTypeApiClient'

interface RoomTypesState {
  items: RoomType[]
  loading: boolean
  error: string | null
}

const initialState: RoomTypesState = {
  items: [],
  loading: false,
  error: null,
}

export const fetchRoomTypes = createAsyncThunk('roomTypes/fetchAll', async () => {
  return await api.fetchRoomTypes()
})

export const createRoomTypeThunk = createAsyncThunk(
  'roomTypes/create',
  async (input: CreateRoomTypeInput) => {
    return await api.createRoomTypeApi(input)
  }
)

export const updateRoomTypeThunk = createAsyncThunk(
  'roomTypes/update',
  async ({ id, input }: { id: string; input: UpdateRoomTypeInput }) => {
    return await api.updateRoomTypeApi(id, input)
  }
)

export const deleteRoomTypeThunk = createAsyncThunk(
  'roomTypes/delete',
  async (id: string) => {
    await api.deleteRoomTypeApi(id)
    return id
  }
)

const roomTypesSlice = createSlice({
  name: 'roomTypes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoomTypes.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchRoomTypes.fulfilled, (state, action) => { state.loading = false; state.items = action.payload })
      .addCase(fetchRoomTypes.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load' })
      .addCase(createRoomTypeThunk.fulfilled, (state, action) => { state.items.push(action.payload) })
      .addCase(updateRoomTypeThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex(i => i.id === action.payload.id)
        if (idx >= 0) state.items[idx] = action.payload
      })
      .addCase(deleteRoomTypeThunk.fulfilled, (state, action) => {
        state.items = state.items.filter(i => i.id !== action.payload)
      })
  },
})

export default roomTypesSlice.reducer
