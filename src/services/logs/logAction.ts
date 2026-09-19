import 'server-only'

import { getCurrentServerSession } from '@/services/auth/serverSession'
import { prisma } from '@/services/db/prisma'
import type { LogAction, LogActor, LogMetadata, LogModule, LogTarget } from '@/types/logs'
import { createLog, LogServiceError } from './logService'
import { sanitizeLogData } from './logSanitizer'

export interface LogActionInput {
  action: LogAction
  description: string
  entityId?: string
  entityType?: string
  metadata?: LogMetadata
  module: LogModule
  target?: LogTarget
  userEmail?: string | null
  userId?: string
  userName?: string | null
  userRole?: string | null
}

async function actorFromUserDocument(id: string, fallback: Partial<LogActor>): Promise<LogActor> {
  const data = await prisma.profiles
    .findUnique({ where: { id }, select: { email: true, name: true, role: true } })
    .catch(() => null)
  const email = fallback.email ?? data?.email
  const name =
    fallback.name ??
    data?.name ??
    email ??
    id
  const role = fallback.role ?? data?.role

  return {
    id,
    ...(email ? { email } : {}),
    name,
    ...(role ? { role } : {}),
  }
}

export async function logAction(input: LogActionInput) {
  const session = input.userId ? null : await getCurrentServerSession()
  const userId = input.userId ?? session?.id

  if (!userId) {
    throw new LogServiceError('logs/actor_required')
  }

  const actor = await actorFromUserDocument(userId, {
    email: input.userEmail ?? session?.email ?? undefined,
    name: input.userName ?? session?.email ?? undefined,
    role: input.userRole ?? session?.role,
  })
  const target =
    input.target ??
    (input.entityId
      ? {
          id: input.entityId,
          type: input.entityType ?? input.module,
        }
      : undefined)

  return createLog({
    action: input.action,
    actor,
    description: input.description,
    metadata: input.metadata ? sanitizeLogData(input.metadata) : undefined,
    module: input.module,
    target: target ? sanitizeLogData(target) : undefined,
  })
}
