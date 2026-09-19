import type { LogDocument } from '@/types/logs'
import { getActorProfileNames } from './actorProfiles'

function isEmailLike(value: string | undefined) {
  return Boolean(value?.includes('@'))
}

export async function withActorProfileNames(logs: LogDocument[]) {
  const actorIds = Array.from(new Set(logs.map((log) => log.actor.id).filter((id) => id && id !== 'unknown')))
  if (!actorIds.length) return logs

  const namesById = await getActorProfileNames(actorIds)
  return logs.map((log) => {
    const profileName = namesById.get(log.actor.id)
    const storedName = isEmailLike(log.actor.name) ? undefined : log.actor.name
    const displayName = profileName ?? storedName

    return {
      ...log,
      actor: {
        ...log.actor,
        ...(displayName ? { displayName, name: displayName } : {}),
      },
    }
  })
}
