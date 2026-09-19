import { createAsyncThunk, createSlice, createSelector, isFulfilled, isPending, isRejected } from '@reduxjs/toolkit'
import type { RootState } from '@/store'
import type { UpdateUserInput, User } from '../types'
import type { CreateStaffUserInput } from '../services/authTypes'
import * as usersApi from '../services/usersApiClient'

interface UsersState {
  users: User[]
  loading: boolean
  error: string | null
  hasMore: boolean
  lastFetchedAt: number | null
  nextCursor: string | null
  total: number | null
}

const initialState: UsersState = {
  users: [],
  loading: false,
  error: null,
  hasMore: false,
  lastFetchedAt: null,
  nextCursor: null,
  total: null,
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message ?? '')
  }
  return 'auth/request_failed'
}
export const fetchUsers = createAsyncThunk('users/fetchUsers', usersApi.fetchUsers)

export const createUser = createAsyncThunk(
  'users/createUser',
  usersApi.createUser,
)

export const updateUser = createAsyncThunk(
  'users/updateUser',
  usersApi.updateUser,
)

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  usersApi.deleteUser,
)

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearUsersError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false
        state.users = action.payload.data
        state.hasMore = action.payload.hasMore
        state.nextCursor = action.payload.nextCursor
        state.total = action.payload.total ?? action.payload.data.length
        state.lastFetchedAt = Date.now()
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.users.unshift(action.payload)
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.users = state.users.map((user) =>
          user.id === action.payload.id ? action.payload : user,
        )
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.users = state.users.filter((user) => user.id !== action.payload)
      })
      .addMatcher(isPending(fetchUsers, createUser, updateUser, deleteUser), (state) => {
        state.loading = true
        state.error = null
      })
      .addMatcher(isRejected(fetchUsers), (state, action) => {
        state.loading = false
        state.error = getErrorMessage(action.error)
      })
      .addMatcher(isRejected(createUser, updateUser, deleteUser), (state) => {
        state.loading = false
      })
      .addMatcher(
        isFulfilled(fetchUsers, createUser, updateUser, deleteUser),
        (state) => {
          state.loading = false
        },
      )
  },
})

export const { clearUsersError } = usersSlice.actions
export const selectUsersState = (state: RootState) => state.users
export const selectUsers = createSelector(
  selectUsersState,
  (users) => users.users,
)
export const selectUsersLoading = createSelector(
  selectUsersState,
  (users) => users.loading,
)
export const selectUsersError = createSelector(
  selectUsersState,
  (users) => users.error,
)
export const selectUsersHasMore = createSelector(
  selectUsersState,
  (users) => users.hasMore,
)
export const selectUsersLastFetchedAt = createSelector(
  selectUsersState,
  (users) => users.lastFetchedAt,
)
export const selectUsersNextCursor = createSelector(
  selectUsersState,
  (users) => users.nextCursor,
)
export const selectUsersTotal = createSelector(
  selectUsersState,
  (users) => users.total,
)
export type { CreateStaffUserInput, UpdateUserInput, UsersState }
export default usersSlice.reducer
