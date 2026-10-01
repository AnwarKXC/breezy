// Server-only access to the organization identity stored in `app_settings`
// (key='organization'). No row = defaults. The logo lives in `public.files`.

import 'server-only'
import { revalidateTag, unstable_cache } from 'next/cache'
import { prisma } from '@/services/db/prisma'
import { deleteFile, saveImage } from '@/services/files/fileStore'
import {
  DEFAULT_APP_NAME,
  DEFAULT_LOGO_URL,
  EMPTY_ORGANIZATION,
  SOCIAL_PLATFORMS,
  brandingLogoUrl,
  type OrganizationDetails,
  type PublicBranding,
} from './branding'
import { OrganizationUpdateSchema } from './schema'

const ORGANIZATION_KEY = 'organization'

interface StoredOrganization extends OrganizationDetails {
  logoFileId: string | null
}

const EMPTY: StoredOrganization = { ...EMPTY_ORGANIZATION, logoFileId: null }

// Read on every page render, changed only from settings. Next's data cache is
// shared by route handlers and server components (a module-level variable is
// not: each bundle gets its own copy, which served stale logos after uploads).
const CACHE_TAG = 'app-settings:organization'

const readRow = unstable_cache(
  async () =>
    (await prisma.app_settings.findUnique({ where: { key: ORGANIZATION_KEY }, select: { value: true } }))?.value ?? null,
  [CACHE_TAG],
  { tags: [CACHE_TAG], revalidate: 3600 },
)

function invalidate() {
  revalidateTag(CACHE_TAG, { expire: 0 })
}

/** Tolerates rows written by older versions: invalid fields fall back to empty. */
function parseStored(raw: unknown): StoredOrganization {
  const value = (raw ?? {}) as Record<string, unknown>
  const parsed = OrganizationUpdateSchema.safeParse({ ...EMPTY_ORGANIZATION, ...value })
  const details = parsed.success ? parsed.data : EMPTY_ORGANIZATION
  const logoFileId = typeof value.logoFileId === 'string' ? value.logoFileId : null
  return { ...details, socials: pickSocials(details.socials), logoFileId }
}

function pickSocials(socials: Record<string, string | undefined>) {
  return Object.fromEntries(SOCIAL_PLATFORMS.flatMap((p) => (socials[p] ? [[p, socials[p]]] : [])))
}

async function readStored(): Promise<StoredOrganization> {
  try {
    const value = await readRow()
    return value === null ? EMPTY : parseStored(value)
  } catch (err) {
    console.error('[branding] read failed:', err)
    return EMPTY
  }
}

async function writeStored(value: StoredOrganization, userId: string) {
  const json = { ...value }
  await prisma.app_settings.upsert({
    where: { key: ORGANIZATION_KEY },
    create: { key: ORGANIZATION_KEY, value: json, updated_by: userId },
    update: { value: json, updated_by: userId, updated_at: new Date() },
  })
  invalidate()
}

export async function getBranding(): Promise<PublicBranding> {
  const { logoFileId, ...details } = await readStored()
  return {
    ...details,
    displayName: details.name || DEFAULT_APP_NAME,
    logoUrl: logoFileId ? brandingLogoUrl(logoFileId) : DEFAULT_LOGO_URL,
    hasCustomLogo: Boolean(logoFileId),
  }
}

/** Uncached read for writes and the logo route, which must never act on a stale logo id. */
async function readFresh(): Promise<StoredOrganization> {
  const row = await prisma.app_settings.findUnique({ where: { key: ORGANIZATION_KEY }, select: { value: true } })
  return row ? parseStored(row.value) : EMPTY
}

export async function getBrandingLogoFileId(): Promise<string | null> {
  return (await readFresh()).logoFileId
}

export async function saveOrganizationDetails(details: OrganizationDetails, userId: string) {
  const current = await readFresh()
  await writeStored({ ...details, socials: pickSocials(details.socials), logoFileId: current.logoFileId }, userId)
}

export async function setOrganizationLogo(bytes: Uint8Array, userId: string) {
  const current = await readFresh()
  const saved = await saveImage(bytes, userId)
  await writeStored({ ...current, logoFileId: saved.id }, userId)
  if (current.logoFileId) await deleteFile(current.logoFileId)
  return brandingLogoUrl(saved.id)
}

export async function removeOrganizationLogo(userId: string) {
  const current = await readFresh()
  if (!current.logoFileId) return
  await writeStored({ ...current, logoFileId: null }, userId)
  await deleteFile(current.logoFileId)
}

export async function resetOrganization() {
  const current = await readFresh()
  await prisma.app_settings.deleteMany({ where: { key: ORGANIZATION_KEY } })
  invalidate()
  if (current.logoFileId) await deleteFile(current.logoFileId)
}
