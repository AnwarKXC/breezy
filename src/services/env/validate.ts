interface EnvVarSpec {
  key: string
  alternatives?: string[]
}

const REQUIRED_VARS: EnvVarSpec[] = [
  { key: 'DATABASE_URL' },
  { key: 'DIRECT_URL' },
]

export function validateEnv(): void {
  const missing: string[] = []

  for (const { key, alternatives } of REQUIRED_VARS) {
    if (process.env[key]) continue
    if (alternatives?.some((alt) => process.env[alt])) continue
    const displayKey = alternatives ? `${key} (or ${alternatives.join(', ')})` : key
    missing.push(displayKey)
  }

  if (missing.length > 0) {
    // Throw instead of process.exit: next.config is also evaluated inside Next's
    // worker processes, and exiting there surfaces as "Jest worker encountered
    // 2 child process exceptions" instead of this message.
    throw new Error(
      `[env] Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}` +
        `\nCopy .env.example to .env and fill in the values.`,
    )
  }

  console.log('[env] All required environment variables are set.')
}
