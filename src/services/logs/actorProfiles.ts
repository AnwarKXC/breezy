import 'server-only'

import { prisma } from '@/services/db/prisma'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

export function publicProfileName(name: string | null | undefined) {
  return name && !name.includes('@') ? name : undefined
}

export async function getActorProfileNames(actorIds: string[]) {
  const ids = Array.from(new Set(actorIds.filter(Boolean)))
  if (!ids.length) return new Map<string, string>()

  const uuidIds = ids.filter(isUuid)
  const externalIds = ids.filter((id) => !isUuid(id))
  const namesByActorId = new Map<string, string>()

  const addProfiles = (
    profiles: Array<{ external_firebase_id: string | null; id: string; name: string | null }> | null,
  ) => {
    for (const profile of profiles ?? []) {
      const name = publicProfileName(profile.name)
      if (!name) continue
      namesByActorId.set(profile.id, name)
      if (profile.external_firebase_id) namesByActorId.set(profile.external_firebase_id, name)
    }
  }

  const select = { id: true, external_firebase_id: true, name: true } as const
  if (uuidIds.length) {
    addProfiles(await prisma.profiles.findMany({ where: { id: { in: uuidIds } }, select }))
  }

  if (externalIds.length) {
    addProfiles(await prisma.profiles.findMany({ where: { external_firebase_id: { in: externalIds } }, select }))
  }

  return namesByActorId
}
