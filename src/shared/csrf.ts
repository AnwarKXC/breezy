import { NextResponse } from 'next/server'

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') ?? []
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').filter(Boolean).map((c) => {
      const [key, ...val] = c.trim().split('=')
      return [key, val.join('=')]
    }),
  )
}

function getOrSetCsrfToken(
  request: Request,
  response?: NextResponse,
): { token: string; response?: NextResponse; isNew: boolean } {
  const cookies = parseCookies(request.headers.get('cookie'))
  let token = cookies[CSRF_COOKIE_NAME]
  let isNew = false

  if (!token) {
    token = generateToken()
    isNew = true
    if (response) {
      response.cookies.set(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24,
      })
    }
  }

  return { token, response, isNew }
}

export function validateCsrf(
  request: Request,
  response?: NextResponse,
): { error?: NextResponse; response?: NextResponse } {
  if (ALLOWED_METHODS.has(request.method)) return { response }

  const { token: cookieToken, response: maybeUpdatedResponse, isNew } = getOrSetCsrfToken(request, response)

  if (!isNew) {
    const headerToken = request.headers.get(CSRF_HEADER_NAME)
    if (!headerToken || headerToken !== cookieToken) {
      return { error: NextResponse.json({ error: 'csrf/token_mismatch' }, { status: 403 }), response: maybeUpdatedResponse }
    }
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  if (!origin && !referer) {
    return { error: NextResponse.json({ error: 'csrf/missing_origin' }, { status: 403 }), response: maybeUpdatedResponse }
  }

  const source = origin ?? referer
  if (!source) {
    return { error: NextResponse.json({ error: 'csrf/missing_origin' }, { status: 403 }), response: maybeUpdatedResponse }
  }

  try {
    const url = new URL(source)
    const host = url.host

    if (host === 'localhost' || host.startsWith('localhost:') || host === '127.0.0.1' || host.startsWith('127.0.0.1:')) {
      return { response: maybeUpdatedResponse }
    }

    if (ALLOWED_ORIGINS.length > 0) {
      const allowed = ALLOWED_ORIGINS.some((allowed) => {
        if (allowed.includes('*')) {
          const pattern = allowed.replace(/\*/g, '.*')
          return new RegExp(`^${pattern}$`).test(host)
        }
        return host === allowed || source === allowed
      })
      if (!allowed) {
        return { error: NextResponse.json({ error: 'csrf/origin_not_allowed' }, { status: 403 }), response: maybeUpdatedResponse }
      }
    } else if (host !== (request.headers.get('host') ?? new URL(request.url).host)) {
      // No allow-list configured: only same-origin requests may mutate.
      return { error: NextResponse.json({ error: 'csrf/origin_not_allowed' }, { status: 403 }), response: maybeUpdatedResponse }
    }

    return { response: maybeUpdatedResponse }
  } catch {
    return { error: NextResponse.json({ error: 'csrf/invalid_origin' }, { status: 403 }), response: maybeUpdatedResponse }
  }
}
