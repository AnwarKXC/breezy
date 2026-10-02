import 'server-only'

import { PlanLimitError } from '@/services/fleet/limits'
import { AuthServiceError } from './authErrors'

export async function guarded<T>(
  code: AuthServiceError['code'],
  operation: () => Promise<T>
) {
  try {
    return await operation()
  } catch (error) {
    // Plan limits carry their own message for the user; pass them through untouched.
    if (error instanceof AuthServiceError || error instanceof PlanLimitError) {
      throw error
    }

    throw new AuthServiceError(code)
  }
}
