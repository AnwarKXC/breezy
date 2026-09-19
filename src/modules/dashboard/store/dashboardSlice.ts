import { createAsyncThunk, createSlice, createSelector } from '@reduxjs/toolkit'
import type { RootState } from '@/store'
import type { DashboardApiResponse } from '../services/dashboardService'
import { fetchDashboardData as fetchDashboardApi } from '../services/dashboardApiClient'

interface DashboardState {
  data: DashboardApiResponse | null
  loading: boolean
  error: string | null
}

const initialState: DashboardState = {
  data: null,
  loading: false,
  error: null,
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'dashboard/request_failed'
}

export const fetchDashboard = createAsyncThunk(
  'dashboard/fetchDashboard',
  fetchDashboardApi,
)

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false
        state.error = getErrorMessage(action.error)
      })
  },
})

const selectDashboardState = (state: RootState) => state.dashboard

export const selectDashboardData = createSelector(
  selectDashboardState,
  (dashboard) => dashboard.data,
)
export const selectDashboardLoading = createSelector(
  selectDashboardState,
  (dashboard) => dashboard.loading,
)
export const selectDashboardError = createSelector(
  selectDashboardState,
  (dashboard) => dashboard.error,
)

export default dashboardSlice.reducer
