import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { Room, CreateRoomInput, UpdateRoomInput } from '../types'
import * as api from '../services/roomsApiClient'

interface RoomsState {
  items: Room[]
  loading: boolean
  error: string | null
}

const initialState: RoomsState = {
  items: [],
  loading: false,
  error: null,
}

export const fetchRooms = createAsyncThunk('rooms/fetchAll', async () => {
  return await api.fetchRooms()
})

export const createRoomThunk = createAsyncThunk(
  'rooms/create',
  async (input: CreateRoomInput) => {
    return await api.createRoomApi(input)
  }
)

export const updateRoomThunk = createAsyncThunk(
  'rooms/update',
  async ({ id, input }: { id: string; input: UpdateRoomInput }) => {
    return await api.updateRoomApi(id, input)
  }
)

export const deleteRoomThunk = createAsyncThunk(
  'rooms/delete',
  async (id: string) => {
    await api.deleteRoomApi(id)
    return id
  }
)

const roomsSlice = createSlice({
  name: 'rooms',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRooms.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchRooms.fulfilled, (state, action) => { state.loading = false; state.items = action.payload })
      .addCase(fetchRooms.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load' })
      .addCase(createRoomThunk.fulfilled, (state, action) => { state.items.push(action.payload) })
      .addCase(updateRoomThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex(i => i.id === action.payload.id)
        if (idx >= 0) state.items[idx] = action.payload
      })
      .addCase(deleteRoomThunk.fulfilled, (state, action) => {
        state.items = state.items.filter(i => i.id !== action.payload)
      })
  },
})

export default roomsSlice.reducer
