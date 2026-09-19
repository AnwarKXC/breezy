import 'server-only'

import { AuthServiceError } from './authErrors'

export async function guarded<T>(
  code: AuthServiceError['code'],
  operation: () => Promise<T>
) {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error
    }

    throw new AuthServiceError(code)
  }
}
