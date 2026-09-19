import 'server-only'

import { logAction } from '@/services/logs'
import { LOG_ACTIONS, LOG_MODULES, type LogAction } from '@/types/logs'
import type { UserRole } from '../types'
import type { VerifiedSession } from './authSession'

type ActivityAction = 'user_created' | 'user_updated' | 'user_deleted' | 'user_viewed'
interface LogUserActivityInput {
  action: ActivityAction
  actor: VerifiedSession
  target: { email?: string | null; id: string; name?: string; role?: UserRole }
}
const ACTION_MAP: Record<ActivityAction, LogAction> = {
  user_created: LOG_ACTIONS.USER_CREATED,
  user_deleted: LOG_ACTIONS.USER_DELETED,
  user_updated: LOG_ACTIONS.USER_UPDATED,
  user_viewed: LOG_ACTIONS.USER_VIEWED,
}
const DESCRIPTION_MAP: Record<ActivityAction, string> = {
  user_created: 'logs.users.created',
  user_deleted: 'logs.users.deleted',
  user_updated: 'logs.users.updated',
  user_viewed: 'logs.users.viewed',
}

export async function logUserActivity(input: LogUserActivityInput) {
  const target = {
    id: input.target.id,
    ...(input.target.email ? { email: input.target.email } : {}),
    ...(input.target.name ? { name: input.target.name } : {}),
    ...(input.target.role ? { role: input.target.role } : {}),
  }

  await logAction({
    action: ACTION_MAP[input.action],
    description: DESCRIPTION_MAP[input.action],
    entityId: target.id,
    entityType: 'user',
    metadata: { after: target },
    module: LOG_MODULES.USERS,
    target: { ...target, type: 'user' },
    userEmail: input.actor.email,
    userId: input.actor.id,
    userName: input.actor.email ?? input.actor.id,
    userRole: input.actor.role,
  })
}

export async function logUserViewed(input: { actor: VerifiedSession; targetUserId: string }) {
  await logUserActivity({
    action: 'user_viewed',
    actor: input.actor,
    target: { id: input.targetUserId },
  })
}

export const tryLogUserActivity = logUserActivity
