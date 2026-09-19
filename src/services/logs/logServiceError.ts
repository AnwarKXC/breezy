export type LogServiceErrorCode =
  | 'logs/actor_required'
  | 'logs/create_failed'
  | 'logs/fetch_failed'
  | 'logs/invalid_session'
  | 'logs/permission_denied'

export class LogServiceError extends Error {
  constructor(readonly code: LogServiceErrorCode) {
    super(code)
    this.name = 'LogServiceError'
  }
}
