import { NextResponse } from 'next/server'

import { getBranding } from '@/shared/branding/server'
import { getAppTheme } from '@/shared/theme/server'

// Manifest of the standalone assistant app installed from /{locale}/assistant.
// It lives outside the locale routes so the proxy serves it without a session:
// browsers fetch manifests without cookies.

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const lang = new URL(request.url).searchParams.get('lang') === 'ar' ? 'ar' : 'en'
  const [{ displayName }, theme] = await Promise.all([getBranding(), getAppTheme()])
  // One app per language: the scope must contain the locale prefix of its pages.
  const base = `/${lang}/assistant`

  const manifest = {
    id: base,
    name: lang === 'ar' ? `مساعد ${displayName}` : `${displayName} Assistant`,
    short_name: lang === 'ar' ? 'المساعد' : 'Assistant',
    description: lang === 'ar' ? 'المساعد الذكي لبيانات الفندق' : 'AI assistant for your hotel data',
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    icons: [192, 512].flatMap((size) => [
      { src: `/assistant-app/icon/${size}?c=${theme.primaryColor.slice(1)}`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' },
      { src: `/assistant-app/icon/${size}?c=${theme.primaryColor.slice(1)}`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'maskable' },
    ]),
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
  }

  return NextResponse.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' },
  })
}
