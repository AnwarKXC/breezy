import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'

import { prisma } from '@/services/db/prisma'
import { DUMMY_PASSWORD_HASH, verifyPassword } from '@/services/auth/password'
import {
  SESSION_COOKIE_NAME,
  createSession,
  deleteSession,
  sessionCookieOptions,
  validateSessionToken,
  type SessionUser,
} from '@/services/auth/sessionStore'
import { logAction } from '@/services/logs'
import { LOG_ACTIONS, LOG_MODULES } from '@/types/logs'
import { validateCsrf } from '@/shared/csrf'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
})

function toSessionResponse(user: SessionUser) {
  return {
    user: { id: user.id, email: user.email, displayName: user.name || null },
    role: user.role,
  }
}

async function tryLogAuthAction(action: typeof LOG_ACTIONS.LOGIN | typeof LOG_ACTIONS.LOGOUT, user: SessionUser) {
  try {
    await logAction({
      action,
      description: action === LOG_ACTIONS.LOGIN ? 'logs.auth.login' : 'logs.auth.logout',
      entityId: user.id,
      entityType: 'auth_session',
      module: LOG_MODULES.AUTH,
      target: { id: user.id, type: 'auth_session' },
      userEmail: user.email,
      userId: user.id,
      userName: user.name || user.email,
      userRole: user.role,
    })
  } catch {
    return
  }
}

export async function GET() {
  try {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
    const session = await validateSessionToken(token)
    if (!session) return NextResponse.json({ session: null })

    const response = NextResponse.json({ session: toSessionResponse(session.user) })
    if (session.renewed && token) {
      response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(session.expiresAt))
    }
    return response
  } catch {
    return NextResponse.json({ error: 'auth/service_unavailable' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const csrf = validateCsrf(request)
  if (csrf.error) return csrf.error

  const rateLimited = rateLimit(request, RateLimitTier.AUTH)
  if (rateLimited.error) return rateLimited.error

  const parsed = loginSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'auth/invalid_credentials' }, { status: 401 })
  }

  try {
    const { email, password } = parsed.data
    const account = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password_hash: true,
        is_active: true,
        profiles: { select: { name: true, role: true, deleted_at: true } },
      },
    })

    const passwordOk = await verifyPassword(password, account?.password_hash ?? DUMMY_PASSWORD_HASH)
    const profile = account?.profiles
    if (!account || !passwordOk || !account.is_active || !profile || profile.deleted_at) {
      return NextResponse.json({ error: 'auth/invalid_credentials' }, { status: 401 })
    }

    const { token, expiresAt } = await createSession(account.id, {
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: request.headers.get('user-agent'),
    })
    await prisma.users.update({ where: { id: account.id }, data: { last_login_at: new Date() } })

    const user: SessionUser = { id: account.id, email: account.email, name: profile.name, role: profile.role }
    void tryLogAuthAction(LOG_ACTIONS.LOGIN, user)

    const response = NextResponse.json({ session: toSessionResponse(user) })
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt))
    return response
  } catch {
    return NextResponse.json({ error: 'auth/service_unavailable' }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  const csrf = validateCsrf(request)
  if (csrf.error) return csrf.error

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = await validateSessionToken(token).catch(() => null)
  if (session) void tryLogAuthAction(LOG_ACTIONS.LOGOUT, session.user)
  await deleteSession(token).catch(() => undefined)

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(new Date(0)), maxAge: 0 })
  return response
}
