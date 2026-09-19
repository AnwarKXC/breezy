const SENSITIVE_KEYS = new Set([
  'accessToken',
  'apiKey',
  'cardNumber',
  'confirmPassword',
  'cvv',
  'otp',
  'password',
  'pin',
  'refreshToken',
  'secret',
  'token',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSensitiveKey(key: string) {
  return SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())
}

export function sanitizeLogData<T>(data: T): T {
  if (Array.isArray(data)) return data.map((item) => sanitizeLogData(item)) as T
  if (!isRecord(data)) return data

  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => !isSensitiveKey(key))
      .map(([key, value]) => [key, sanitizeLogData(value)]),
  ) as T
}
