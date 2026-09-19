const KNOWN_SAFE_ERRORS = new RegExp(
  '^(auth/|contacts/|users/|rooms/|room-types/|pricing/|logs/|pagination/)',
)

export function sanitizeErrorMessage(message: unknown): string {
  if (typeof message === 'string' && KNOWN_SAFE_ERRORS.test(message)) {
    return message
  }
  return 'An unexpected error occurred'
}
