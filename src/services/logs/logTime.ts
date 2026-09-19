import type { CreateLogDocumentInput, LogTimestamp } from '@/types/logs'

export function timestampFromIso(value: string): LogTimestamp {
  const milliseconds = new Date(value).getTime()
  if (!Number.isFinite(milliseconds)) {
    throw new Error('logs/invalid_timestamp')
  }

  return {
    nanoseconds: (milliseconds % 1000) * 1000000,
    seconds: Math.floor(milliseconds / 1000),
  }
}

export function timestampToIso(value: LogTimestamp) {
  return new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1000000)).toISOString()
}

export function createdAtToIso(value: CreateLogDocumentInput['createdAt']) {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString()
  return timestampToIso(value)
}
