import { initSupabase, hasFlag } from './shared.mjs'

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

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.has(key) && !SENSITIVE_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, sanitize(item)]),
  )
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after)
}

const apply = hasFlag('--apply')
const supabase = await initSupabase()
const batchSize = 250
let scanned = 0
let updated = 0
let cursorId = null

for (;;) {
  let query = supabase
    .from('audit_logs')
    .select('id, metadata, target')
    .order('id')
    .limit(batchSize)

  if (cursorId) query = query.gt('id', cursorId)

  const { data: rows, error } = await query
  if (error) throw error
  if (!rows || rows.length === 0) break

  for (const row of rows) {
    scanned += 1
    const patches = {}

    if (row.metadata) {
      const clean = sanitize(row.metadata)
      if (changed(row.metadata, clean)) patches.metadata = clean
    }

    if (row.target) {
      const clean = sanitize(row.target)
      if (changed(row.target, clean)) patches.target = clean
    }

    if (Object.keys(patches).length) {
      updated += 1
      if (apply) {
        const { error: updateError } = await supabase
          .from('audit_logs')
          .update(patches)
          .eq('id', row.id)

        if (updateError) throw updateError
      }
    }

    cursorId = row.id
  }
}

console.log(`${apply ? 'Done' : 'Dry run'}: scanned ${scanned} audit log rows, ${updated} need sanitizing.`)
