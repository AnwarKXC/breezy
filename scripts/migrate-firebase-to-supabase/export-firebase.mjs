import path from 'node:path'
import { EXPORT_DIR, ensureDir, initFirebase, writeJson } from './shared.mjs'

function jsonSafe(value) {
  if (!value || typeof value !== 'object') return value
  if (value?.toDate) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(jsonSafe)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]))
}

async function exportCollection(db, name) {
  const snapshot = await db.collection(name).get()
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: jsonSafe(doc.data()),
  }))
}

async function exportAuthUsers(auth) {
  const users = []
  let pageToken

  do {
    const page = await auth.listUsers(1000, pageToken)
    users.push(
      ...page.users.map((user) => ({
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        disabled: user.disabled,
        emailVerified: user.emailVerified,
        customClaims: user.customClaims ?? {},
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
      })),
    )
    pageToken = page.pageToken
  } while (pageToken)

  return users
}

const { auth, db } = await initFirebase()
await ensureDir(EXPORT_DIR)

const exportedAt = new Date().toISOString()
const exportData = {
  exportedAt,
  firebaseAuthUsers: await exportAuthUsers(auth),
  users: await exportCollection(db, 'users'),
  bookings: await exportCollection(db, 'bookings'),
  logs: await exportCollection(db, 'logs'),
}

const file = path.join(EXPORT_DIR, `firebase-export-${exportedAt.replaceAll(':', '-')}.json`)
await writeJson(file, exportData)

console.log(JSON.stringify({
  file,
  users: exportData.users.length,
  firebaseAuthUsers: exportData.firebaseAuthUsers.length,
  bookings: exportData.bookings.length,
  logs: exportData.logs.length,
}, null, 2))
