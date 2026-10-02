import { NextResponse, type NextRequest } from 'next/server'

import { canAccessModule, isPermissionModule } from '@/config/rbac'
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  validateSessionToken,
  type ValidatedSession,
} from '@/services/auth/sessionStore'
import { getLicenseStatus } from '@/services/fleet/license'

const locales = ['en', 'ar'] as const
const PASS_THROUGH_PATHS = ['/api/', '/_next/', '/static/', '/sw.js', '/offline']
const PASS_THROUGH_FILES = ['/favicon.ico', '/robots.txt', '/manifest.webmanifest']

function getLocale(pathname: string) {
  const segment = pathname.split('/')[1]
  return locales.includes(segment as (typeof locales)[number]) ? segment : 'en'
}

function hasLocalePrefix(pathname: string) {
  return locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
}

function stripLocale(pathname: string) {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return '/'
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(3)
  }
  return pathname
}

function isPublicPath(pathname: string) {
  const stripped = hasLocalePrefix(pathname) ? stripLocale(pathname) : pathname
  if (PASS_THROUGH_PATHS.some((p) => stripped.startsWith(p))) return true
  if (PASS_THROUGH_FILES.includes(stripped)) return true
  return ['/login', '/forgot-password', '/reset-password', '/signup', '/auth/', '/unauthorized', '/paused'].some((p) => stripped === p || stripped.startsWith(p))
}

function getRouteKey(pathname: string) {
  return pathname.split('/')[2]
}

// Writes still allowed when the license blocks the instance: signing in/out,
// password resets, control-plane calls and browser CSP reports.
const READ_ONLY_EXEMPT_API = ['/api/auth/', '/api/system/', '/api/csp-report']
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

async function licenseApiResponse(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (READ_ONLY_EXEMPT_API.some((p) => pathname.startsWith(p))) return null
  const license = await getLicenseStatus()
  // Locked by the provider: nothing is served, reads included.
  if (license.locked) return NextResponse.json({ error: 'license/locked' }, { status: 423 })
  if (SAFE_METHODS.includes(request.method)) return null
  return license.readOnly ? NextResponse.json({ error: 'license/read_only' }, { status: 403 }) : null
}

const dirConfig: Record<string, 'ltr' | 'rtl'> = { en: 'ltr', ar: 'rtl' }
function withLocaleHeaders(response: NextResponse, locale: string, dir: string) {
  response.headers.set('x-locale', locale)
  response.headers.set('x-dir', dir)
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // API routes authorize themselves; the proxy only applies the license gate.
  if (pathname.startsWith('/api/')) return (await licenseApiResponse(request)) ?? NextResponse.next()

  const locale = getLocale(pathname)
  const dir = dirConfig[locale] || 'ltr'
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  // Locked by the provider: every page shows the paused notice instead of the app.
  if (stripLocale(pathname) !== '/paused' && (await getLicenseStatus()).locked) {
    return withLocaleHeaders(NextResponse.redirect(new URL(`/${locale}/paused`, request.url)), locale, dir)
  }

  if (isPublicPath(pathname)) {
    return withLocaleHeaders(NextResponse.next(), locale, dir)
  }

  let session: ValidatedSession | null = null
  try {
    session = await validateSessionToken(token)
  } catch {
    session = null
  }

  if (!session) {
    const redirect = redirectToLogin(request)
    if (token) redirect.cookies.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(new Date(0)), maxAge: 0 })
    return withLocaleHeaders(redirect, locale, dir)
  }

  const routeKey = getRouteKey(pathname)
  const allowed = !routeKey || !isPermissionModule(routeKey) || canAccessModule(session.user.role, routeKey)
  const response = allowed ? NextResponse.next() : redirectToUnauthorized(request)

  // Sliding expiry: re-issue the cookie when the session was extended.
  if (session.renewed && token) {
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(session.expiresAt))
  }

  return withLocaleHeaders(response, locale, dir)
}

function redirectToUnauthorized(request: NextRequest) {
  const { pathname } = request.nextUrl
  const locale = getLocale(pathname)
  const unauthorizedUrl = new URL(`/${locale}/unauthorized`, request.url)

  return NextResponse.redirect(unauthorizedUrl)
}

function redirectToLogin(request: NextRequest) {
  const { pathname } = request.nextUrl
  const locale = getLocale(pathname)
  const loginUrl = new URL(`/${locale}/login`, request.url)
  loginUrl.searchParams.set('next', pathname)

  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/:locale(en|ar)', '/:locale(en|ar)/((?!login).*)', '/api/:path*'],
}
