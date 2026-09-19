import { NextResponse } from 'next/server'
import { authorizeRoute, deleteUser, updateUser } from '@/modules/users/services/server'
import { errorResponse } from '@/modules/users/services/routeErrors'
import { ACTIONS } from '@/modules/users/roles'
import { validateCsrf } from '@/shared/csrf'
import { userJson } from '@/modules/users/services/userResponse'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { UserUpdateSchema, zodErrorMessage } from '@/shared/validation'

interface UserRouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: UserRouteContext) {
  try {
    const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
    if (rateLimited.error) return rateLimited.error
    const csrf = validateCsrf(request)
    if (csrf.error) return csrf.error

    const auth = await authorizeRoute(request, ACTIONS.USERS_UPDATE)
    if ('response' in auth) return auth.response

    const { id } = await context.params
    const body = await request.json()
    const parsed = UserUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    return NextResponse.json({
      data: userJson(await updateUser({ ...parsed.data, id })),
      message: 'User updated successfully',
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, context: UserRouteContext) {
  try {
    const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
    if (rateLimited.error) return rateLimited.error
    const csrf = validateCsrf(request)
    if (csrf.error) return csrf.error

    const auth = await authorizeRoute(request, ACTIONS.USERS_DELETE)
    if ('response' in auth) return auth.response

    const { id } = await context.params
    await deleteUser(id)
    return NextResponse.json({
      data: { id },
      message: 'User deleted successfully',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
