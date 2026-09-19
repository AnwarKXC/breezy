import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldPath, getFirestore } from 'firebase-admin/firestore'

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

function init() {
  if (getApps().length) return
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    ? cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON))
    : undefined
  initializeApp(credentials ? { credential: credentials } : undefined)
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after)
}

init()

const db = getFirestore()
const dryRun = process.argv.includes('--dry-run')
const batchSize = 250
let cursor = null
let scanned = 0
let updated = 0

for (;;) {
  let query = db.collection('logs').orderBy(FieldPath.documentId()).limit(batchSize)
  if (cursor) query = query.startAfter(cursor)

  const snapshot = await query.get()
  if (snapshot.empty) break

  const batch = db.batch()
  for (const doc of snapshot.docs) {
    scanned += 1
    const data = doc.data()
    const target = sanitize(data.target)
    const metadata = sanitize(data.metadata)
    const patch = {}

    if (changed(data.target, target)) patch.target = target
    if (changed(data.metadata, metadata)) patch.metadata = metadata

    if (Object.keys(patch).length) {
      updated += 1
      if (!dryRun) batch.update(doc.ref, patch)
    }
  }

  if (!dryRun) await batch.commit()
  cursor = snapshot.docs.at(-1)
  if (snapshot.size < batchSize) break
}

console.log(`${dryRun ? 'Dry run' : 'Done'}: scanned ${scanned} log documents, ${updated} need sanitizing.`)
