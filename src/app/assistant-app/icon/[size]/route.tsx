import { ImageResponse } from 'next/og'

import { DEFAULT_PRIMARY_COLOR, foregroundFor, normalizeHexColor } from '@/shared/theme/theme'

// Home-screen icon of the assistant app: the chat glyph on the hotel's primary
// color. Full-bleed with the glyph inside the maskable safe zone, so one image
// serves both `any` and `maskable`. `?c=RRGGBB` is the theme color (also busts
// caches when the theme changes).

const SIZES = new Set([180, 192, 512])

export async function GET(request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size)
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 })

  const background = normalizeHexColor(`#${new URL(request.url).searchParams.get('c') ?? ''}`) ?? DEFAULT_PRIMARY_COLOR
  const foreground = foregroundFor(background)
  const glyph = Math.round(size * 0.5)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background }}>
        <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke={foreground} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-11.8 7.04L4 20l1.1-4.4A8 8 0 1 1 21 12Z" />
          <path d="M9.5 9.5 12 8l2.5 1.5M9 13.5h6" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
