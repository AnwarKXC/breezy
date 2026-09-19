'use client'

import { useSyncExternalStore } from 'react'

import { useAuth } from '@/modules/auth'
import { canPerformAction, type ActionPermission } from '@/config/rbac'

const subscribeToNothing = () => () => {}

/**
 * True once hydration has finished. The auth role is only known in the browser,
 * so permission-gated UI must match the server HTML (nothing) on the first pass.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false)
}

export function useCan(action: ActionPermission): boolean {
  const { role } = useAuth()
  const hydrated = useIsHydrated()
  return hydrated && !!role && canPerformAction(role, action)
}

export default useCan
