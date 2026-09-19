import { NextResponse } from 'next/server'
import { authorizeRoute, createUser, getUsersPage } from '@/modules/users/services/server'
import { errorResponse } from '@/modules/users/services/routeErrors'
import { ACTIONS } from '@/modules/users/roles'
import { USER_ROLES } from '@/config/rbac'
import { decodeCursor } from '@/shared/pagination/cursor'
import { validateCsrf } from '@/shared/csrf'
import type { UserRole } from '@/modules/users/types'
import { userJson, usersPageJson } from '@/modules/users/services/userResponse'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { UserCreateSchema, zodErrorMessage } from '@/shared/validation'

function getLimit(value: string | null) {
  if (!value) return undefined
  const parsed = Number(value)
  if (Number.isInteger(parsed) && parsed > 0) return Math.min(parsed, 100)
  throw new Error('auth/invalid_form')
}

function getRole(value: string | null) {
  if (!value || value === 'all') return undefined
  if (USER_ROLES.includes(value as UserRole)) return value as UserRole
  throw new Error('auth/invalid_form')
}

function getCursor(value: string | null) {
  if (!value) return undefined
  decodeCursor(value)
  return value
}

export async function GET(request: Request) {
  try {
    const rateLimited = rateLimit(request, RateLimitTier.READ)
    if (rateLimited.error) return rateLimited.error
    const auth = await authorizeRoute(request, ACTIONS.USERS_READ)
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(request.url)
    const page = await getUsersPage({
      cursor: getCursor(searchParams.get('cursor')),
      limit: getLimit(searchParams.get('limit')),
      role: getRole(searchParams.get('role')),
      search: searchParams.get('search') ?? undefined,
    })
    return NextResponse.json(usersPageJson(page))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('pagination/invalid_')) {
      return NextResponse.json({ error: 'auth/invalid_form' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'auth/invalid_form') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
    if (rateLimited.error) return rateLimited.error
    const csrf = validateCsrf(request)
    if (csrf.error) return csrf.error

    const auth = await authorizeRoute(request, ACTIONS.USERS_CREATE)
    if ('response' in auth) return auth.response

    const body = await request.json()
    const parsed = UserCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    return NextResponse.json(
      {
        data: userJson(await createUser(parsed.data)),
        message: 'User created successfully',
      },
      { status: 201 },
    )
  } catch (error) {
    return errorResponse(error)
  }
}
