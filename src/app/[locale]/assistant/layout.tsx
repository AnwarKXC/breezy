import type { Metadata, Viewport } from 'next'

import { checkLocale } from '@/i18n/config'
import { AuthStateSync } from '@/modules/auth'
import { getBranding } from '@/shared/branding/server'
import { getAppTheme } from '@/shared/theme/server'
import { themeCssVars } from '@/shared/theme/theme'

// Standalone assistant app (its own installable PWA, scope /{locale}/assistant):
// no dashboard shell, its own manifest and home-screen icon.

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = checkLocale((await params).locale)
  const [{ displayName }, theme] = await Promise.all([getBranding(), getAppTheme()])
  const shortName = locale === 'ar' ? 'المساعد' : 'Assistant'
  return {
    title: locale === 'ar' ? `مساعد ${displayName}` : `${displayName} Assistant`,
    manifest: `/assistant-app/manifest.webmanifest?lang=${locale}`,
    icons: { apple: `/assistant-app/icon/180?c=${theme.primaryColor.slice(1)}` },
    appleWebApp: { capable: true, statusBarStyle: 'default', title: shortName },
  }
}

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  viewportFit: 'cover',
  // The on-screen keyboard shrinks the layout, keeping the composer visible.
  interactiveWidget: 'resizes-content',
}

export default async function AssistantAppLayout({ children }: { children: React.ReactNode }) {
  const theme = await getAppTheme()
  // Values are validated #RRGGBB hex, so interpolating them into CSS is safe.
  const themeCss = theme.isDefault
    ? null
    : `:root{${Object.entries(themeCssVars(theme.primaryColor)).map(([k, v]) => `${k}:${v}`).join(';')}}`

  return (
    <>
      {themeCss && <style>{themeCss}</style>}
      <AuthStateSync />
      {children}
    </>
  )
}
