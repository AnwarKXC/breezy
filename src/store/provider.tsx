// 📁 src/store/provider.tsx - Redux Provider wrapper
'use client'

import { Provider } from 'react-redux'
import { store } from './index'

/**
 * Redux Provider component
 * Wrap your app with this to enable Redux throughout
 */
export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>
}