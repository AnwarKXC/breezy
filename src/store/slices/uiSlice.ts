// 📁 src/store/slices/uiSlice.ts - UI state slice
import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/store'
// Locale type (duplicated for store isolation)
type Locale = 'en' | 'ar'

/**
 * UI State interface
 */
interface UIState {
  // Language/i18n
  locale: Locale
  dir: 'ltr' | 'rtl'
  
  // Sidebar
  sidebarOpen: boolean
  
  // Theme (future)
  theme: 'light' | 'dark'
  
  // Loading states
  isGlobalLoading: boolean
  
  // Notifications
  notification: {
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  } | null
}

const initialState: UIState = {
  locale: 'en',
  dir: 'ltr',
  sidebarOpen: true,
  theme: 'light',
  isGlobalLoading: false,
  notification: null,
}

/**
 * UI Slice for application state management
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    /**
     * Set locale and direction
     */
    setLocale: (state, action: PayloadAction<Locale>) => {
      state.locale = action.payload
      state.dir = action.payload === 'ar' ? 'rtl' : 'ltr'
    },
    
    /**
     * Toggle sidebar
     */
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    
    /**
     * Set sidebar open state
     */
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload
    },
    
    /**
     * Set theme
     */
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload
    },
    
    /**
     * Set global loading
     */
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.isGlobalLoading = action.payload
    },
    
    /**
     * Show notification
     */
    showNotification: (
      state,
      action: PayloadAction<{
        message: string
        type: 'success' | 'error' | 'warning' | 'info'
      }>
    ) => {
      state.notification = action.payload
    },
    
    /**
     * Clear notification
     */
    clearNotification: (state) => {
      state.notification = null
    },
  },
})

export const {
  setLocale,
  toggleSidebar,
  setSidebarOpen,
  setTheme,
  setGlobalLoading,
  showNotification,
  clearNotification,
} = uiSlice.actions

export const selectUIState = (state: RootState) => state.ui
export const selectSidebarOpen = createSelector(
  selectUIState,
  (ui) => ui.sidebarOpen,
)
export const selectUIDir = createSelector(
  selectUIState,
  (ui) => ui.dir,
)
export const selectUILocale = createSelector(
  selectUIState,
  (ui) => ui.locale,
)
export const selectGlobalLoading = createSelector(
  selectUIState,
  (ui) => ui.isGlobalLoading,
)
export const selectNotification = createSelector(
  selectUIState,
  (ui) => ui.notification,
)

export default uiSlice.reducer