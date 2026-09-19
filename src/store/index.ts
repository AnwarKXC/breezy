// 📁 src/store/index.ts - Redux store configuration
import { configureStore } from '@reduxjs/toolkit'
import { usersReducer } from '@/modules/users/store'
import { dashboardReducer } from '@/modules/dashboard/store'
import roomTypesReducer from '@/modules/room-types/store/roomTypesSlice'
import roomsReducer from '@/modules/rooms/store/roomsSlice'
import pricingReducer from '@/modules/pricing/store/pricingSlice'
import accountingReducer from '@/modules/accounting/store/accountingSlice'
import authReducer from './authSlice'
import uiReducer from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    accounting: accountingReducer,
    users: usersReducer,
    dashboard: dashboardReducer,
    roomTypes: roomTypesReducer,
    rooms: roomsReducer,
    pricing: pricingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
})

// Infer types from store
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
