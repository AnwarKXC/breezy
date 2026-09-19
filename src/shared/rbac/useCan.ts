'use client'

import { useAuth } from '@/modules/auth'
import { canPerformAction, type ActionPermission } from '@/config/rbac'

export function useCan(action: ActionPermission): boolean {
  const { role } = useAuth()
  return !!role && canPerformAction(role, action)
}

export default useCan
