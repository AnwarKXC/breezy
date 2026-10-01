// Server-only access to the dashboard theme stored in `app_settings`
// (key='theme', value={ primaryColor: '#RRGGBB' }). No row = default theme.

import 'server-only'
import { revalidateTag, unstable_cache } from 'next/cache'
import { prisma } from '@/services/db/prisma'
import { DEFAULT_PRIMARY_COLOR, normalizeHexColor } from './theme'

const THEME_KEY = 'theme'

export interface AppTheme {
  primaryColor: string
  isDefault: boolean
}

const DEFAULT_THEME: AppTheme = { primaryColor: DEFAULT_PRIMARY_COLOR, isDefault: true }

// Read on every dashboard render, changed only from settings. Uses Next's data
// cache (shared by route handlers and server components) and expires on write.
const CACHE_TAG = 'app-settings:theme'

const readRow = unstable_cache(
  async () =>
    (await prisma.app_settings.findUnique({ where: { key: THEME_KEY }, select: { value: true } }))?.value ?? null,
  [CACHE_TAG],
  { tags: [CACHE_TAG], revalidate: 3600 },
)

export async function getAppTheme(): Promise<AppTheme> {
  try {
    const value = await readRow()
    const primaryColor = normalizeHexColor((value as { primaryColor?: unknown } | null)?.primaryColor)
    return primaryColor ? { primaryColor, isDefault: false } : DEFAULT_THEME
  } catch (err) {
    console.error('[theme] getAppTheme failed:', err)
    return DEFAULT_THEME
  }
}

export async function saveAppTheme(primaryColor: string, userId: string): Promise<void> {
  const value = { primaryColor }
  await prisma.app_settings.upsert({
    where: { key: THEME_KEY },
    create: { key: THEME_KEY, value, updated_by: userId },
    update: { value, updated_by: userId, updated_at: new Date() },
  })
  revalidateTag(CACHE_TAG, { expire: 0 })
}

export async function resetAppTheme(): Promise<void> {
  await prisma.app_settings.deleteMany({ where: { key: THEME_KEY } })
  revalidateTag(CACHE_TAG, { expire: 0 })
}
