export type CursorValue =
  | string
  | number
  | {
      nanoseconds: number
      seconds: number
    }

export interface CursorPayload {
  id: string
  value: CursorValue
}

export class PaginationCursorError extends Error {
  constructor() {
    super('pagination/invalid_cursor')
    this.name = 'PaginationCursorError'
  }
}

function isTimestampValue(value: unknown): value is { nanoseconds: number; seconds: number } {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { nanoseconds?: unknown; seconds?: unknown }
  return Number.isFinite(candidate.seconds) && Number.isFinite(candidate.nanoseconds)
}

function isCursorValue(value: unknown): value is CursorValue {
  return typeof value === 'string' || typeof value === 'number' || isTimestampValue(value)
}

export function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown
    if (!payload || typeof payload !== 'object') throw new PaginationCursorError()

    const candidate = payload as Partial<CursorPayload>
    if (typeof candidate.id !== 'string' || !candidate.id || !isCursorValue(candidate.value)) {
      throw new PaginationCursorError()
    }

    return { id: candidate.id, value: candidate.value }
  } catch (error) {
    if (error instanceof PaginationCursorError) throw error
    throw new PaginationCursorError()
  }
}

export function getPageLimit(limit: number | undefined, defaultLimit: number, maxLimit: number) {
  if (limit === undefined) return defaultLimit
  if (!Number.isInteger(limit) || limit < 1) throw new Error('pagination/invalid_limit')
  return Math.min(limit, maxLimit)
}

export function requireTimestampCursorValue(value: CursorValue) {
  if (!isTimestampValue(value)) throw new PaginationCursorError()
  return value
}

export function requireNumberCursorValue(value: CursorValue) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new PaginationCursorError()
  return value
}

export function requireStringCursorValue(value: CursorValue) {
  if (typeof value !== 'string') throw new PaginationCursorError()
  return value
}
