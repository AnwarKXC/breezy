import { describe, it, expect } from 'vitest'
import dashboardReducer, { fetchDashboard, selectDashboardData, selectDashboardLoading, selectDashboardError } from '../dashboardSlice'

describe('dashboardSlice', () => {
  const initialState = {
    data: null,
    loading: false,
    error: null,
  }

  it('returns correct initial state', () => {
    expect(dashboardReducer(undefined, { type: 'unknown' })).toEqual(initialState)
  })

  it('handles fetchDashboard.pending', () => {
    const state = dashboardReducer(initialState, fetchDashboard.pending(''))
    expect(state.loading).toBe(true)
    expect(state.error).toBeNull()
  })

  it('handles fetchDashboard.fulfilled', () => {
    const payload = { totalUsers: 5, activeBookings: 10, availableRooms: 20, totalRevenue: 5000, occupancyRate: 75, todayCheckIns: 3, todayCheckOuts: 2 }
    const state = dashboardReducer(initialState, fetchDashboard.fulfilled(payload, ''))
    expect(state.loading).toBe(false)
    expect(state.data).toEqual(payload)
  })

  it('handles fetchDashboard.rejected', () => {
    const state = dashboardReducer(initialState, fetchDashboard.rejected(new Error('Network error'), ''))
    expect(state.loading).toBe(false)
    expect(state.error).toBe('Network error')
  })

  it('handles fetchDashboard.rejected with SerializedError', () => {
    const state = dashboardReducer(initialState, fetchDashboard.rejected({ message: 'Serialized error' } as Error, ''))
    expect(state.loading).toBe(false)
    expect(state.error).toBe('Serialized error')
  })

  it('handles fetchDashboard.rejected with null', () => {
    const state = dashboardReducer(initialState, fetchDashboard.rejected(null, ''))
    expect(state.loading).toBe(false)
    expect(state.error).toBe('Rejected')
  })

  describe('selectors', () => {
    const mockState = {
      dashboard: {
        data: { totalUsers: 5, activeBookings: 10, availableRooms: 20, totalRevenue: 5000, occupancyRate: 75, todayCheckIns: 3, todayCheckOuts: 2 },
        loading: true,
        error: 'some error',
      },
    }

    it('selectDashboardData returns data', () => {
      expect(selectDashboardData(mockState as never)).toEqual(mockState.dashboard.data)
    })

    it('selectDashboardLoading returns loading', () => {
      expect(selectDashboardLoading(mockState as never)).toBe(true)
    })

    it('selectDashboardError returns error', () => {
      expect(selectDashboardError(mockState as never)).toBe('some error')
    })
  })
})
