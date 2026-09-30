// Server-only access to the dashboard theme stored in `app_settings`
// (key='theme', value={ primaryColor: '#RRGGBB' }). No row = default theme.

import 'server-only'
import { prisma } from '@/services/db/prisma'
import { DEFAULT_PRIMARY_COLOR, normalizeHexColor } from './theme'

const THEME_KEY = 'theme'

export interface AppTheme {
  primaryColor: string
  isDefault: boolean
}

const DEFAULT_THEME: AppTheme = { primaryColor: DEFAULT_PRIMARY_COLOR, isDefault: true }

// Read on every dashboard render, changed only from settings: cache briefly
// in-process and invalidate on write (other instances converge in TTL).
const THEME_TTL_MS = 60 * 1000
let themeCache: { theme: AppTheme; ts: number } | null = null

export async function getAppTheme(): Promise<AppTheme> {
  if (themeCache && Date.now() - themeCache.ts < THEME_TTL_MS) return themeCache.theme
  try {
    const row = await prisma.app_settings.findUnique({ where: { key: THEME_KEY }, select: { value: true } })
    const primaryColor = normalizeHexColor((row?.value as { primaryColor?: unknown } | null)?.primaryColor)
    const theme = primaryColor ? { primaryColor, isDefault: false } : DEFAULT_THEME
    themeCache = { theme, ts: Date.now() }
    return theme
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
  themeCache = null
}

export async function resetAppTheme(): Promise<void> {
  await prisma.app_settings.deleteMany({ where: { key: THEME_KEY } })
  themeCache = null
}
