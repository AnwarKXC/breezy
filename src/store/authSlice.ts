import { createAsyncThunk, createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit'

import type { RootState } from '@/store'
import {
  authService,
  isAuthServiceErrorCode,
  type AuthenticatedUser,
  type AuthServiceErrorCode,
  type AuthSession,
  type LoginCredentials,
} from '@/services/auth'
import type { UserRole } from '@/types/auth'

interface AuthState {
  user: AuthenticatedUser | null
  role: UserRole | null
  loading: boolean
  initializing: boolean
  isAuthenticated: boolean
  error: AuthServiceErrorCode | null
  blockedUntil: number
  attempts: number
  windowStart: number
}

const initialState: AuthState = {
  user: null,
  role: null,
  loading: false,
  initializing: true,
  isAuthenticated: false,
  error: null,
  blockedUntil: 0,
  attempts: 0,
  windowStart: 0,
}

const MAX_ATTEMPTS = 5
const WINDOW_MS = 60_000

function authErrorCode(error: unknown): AuthServiceErrorCode {
  if (
    error instanceof Error &&
    'code' in error &&
    isAuthServiceErrorCode(error.code)
  ) {
    return error.code
  }

  return 'auth/login_failed'
}

function applySession(state: AuthState, session: AuthSession) {
  state.user = session.user
  state.role = session.role
  state.isAuthenticated = true
  state.error = null
  state.blockedUntil = 0
  state.attempts = 0
  state.windowStart = 0
}

export const login = createAsyncThunk<
  AuthSession,
  LoginCredentials,
  { state: RootState; rejectValue: AuthServiceErrorCode }
>('auth/login', async ({ email, password }, { getState, rejectWithValue }) => {
  const { blockedUntil } = getState().auth
  if (blockedUntil > Date.now()) {
    return rejectWithValue('auth/login_failed')
  }
  try {
    return await authService.login(email, password)
  } catch (error) {
    return rejectWithValue(authErrorCode(error))
  }
})

export const logout = createAsyncThunk<void, void, { rejectValue: AuthServiceErrorCode }>(
  'auth/logout',
  async (_arg, { rejectWithValue }) => {
    try {
      await authService.logout()
    } catch (error) {
      return rejectWithValue(authErrorCode(error))
    }
  },
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthSession | null>) {
      if (!action.payload) {
        state.user = null
        state.role = null
        state.isAuthenticated = false
        state.error = null
        return
      }

      applySession(state, action.payload)
    },
    setAuthError(state, action: PayloadAction<AuthServiceErrorCode | null>) {
      state.error = action.payload
    },
    setAuthLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setAuthInitializing(state, action: PayloadAction<boolean>) {
      state.initializing = action.payload
    },
    clearAuthError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        applySession(state, action.payload)
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.user = null
        state.role = null
        state.isAuthenticated = false
        state.error = action.payload ?? 'auth/login_failed'
        const now = Date.now()
        if (now > state.windowStart + WINDOW_MS) {
          state.attempts = 1
          state.windowStart = now
        } else {
          state.attempts++
        }
        if (state.attempts >= MAX_ATTEMPTS) {
          state.blockedUntil = state.windowStart + WINDOW_MS
        }
      })
      .addCase(logout.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false
        state.user = null
        state.role = null
        state.isAuthenticated = false
        state.error = null
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload ?? 'auth/logout_failed'
      })
  },
})

export const { clearAuthError, setAuthError, setAuthInitializing, setAuthLoading, setUser } = authSlice.actions
export const selectAuthState = (state: RootState) => state.auth
export const selectAuthUser = createSelector(
  selectAuthState,
  (auth) => auth.user,
)
export const selectAuthRole = createSelector(
  selectAuthState,
  (auth) => auth.role,
)
export const selectAuthLoading = createSelector(
  selectAuthState,
  (auth) => auth.loading,
)
export const selectAuthInitializing = createSelector(
  selectAuthState,
  (auth) => auth.initializing,
)
export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (auth) => auth.isAuthenticated,
)
export const selectAuthError = createSelector(
  selectAuthState,
  (auth) => auth.error,
)
export const selectBlockedUntil = createSelector(
  selectAuthState,
  (auth) => auth.blockedUntil,
)
export type { AuthState }
export default authSlice.reducer
