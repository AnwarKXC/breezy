import fs from 'node:fs/promises'
import path from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { createClient } from '@supabase/supabase-js'

export const ROOT = process.cwd()
export const SCRIPT_DIR = path.join(ROOT, 'scripts', 'migrate-firebase-to-supabase')
export const EXPORT_DIR = path.join(SCRIPT_DIR, 'exports')
export const TRANSFORMED_DIR = path.join(SCRIPT_DIR, 'transformed')

export const VALID_ROLES = new Set(['admin', 'accountant', 'front_desk'])
export const VALID_BOOKING_STATUS = new Set(['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled'])
export const VALID_LOG_MODULES = new Set(['accounting', 'auth', 'contacts', 'reservations', 'users'])
export const VALID_LOG_ACTIONS = new Set([
  'accounting_created',
  'accounting_deleted',
  'accounting_updated',
  'contact_created',
  'contact_deleted',
  'contact_updated',
  'login',
  'logout',
  'reservation_created',
  'reservation_deleted',
  'reservation_updated',
  'user_created',
  'user_deleted',
  'user_updated',
  'user_viewed',
])

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

export function hasFlag(name) {
  return process.argv.includes(name)
}

export function getArg(name) {
  const prefix = `${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

export async function writeJson(file, value) {
  await ensureDir(path.dirname(file))
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}

export function loadEnv(file = path.join(ROOT, '.env.local')) {
  return fs
    .readFile(file, 'utf8')
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const index = trimmed.indexOf('=')
        if (index < 0) continue
        const key = trimmed.slice(0, index).trim()
        let value = trimmed.slice(index + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        value = value.replaceAll('\\n', '\n')
        if (process.env[key] === undefined) process.env[key] = value
      }
    })
    .catch(() => undefined)
}

export function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export async function initFirebase() {
  await loadEnv()
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: requiredEnv('FIREBASE_PROJECT_ID'),
        clientEmail: requiredEnv('FIREBASE_CLIENT_EMAIL'),
        privateKey: requiredEnv('FIREBASE_PRIVATE_KEY'),
      }),
    })
  }

  return {
    auth: getAuth(),
    db: getFirestore(),
  }
}

export async function initSupabase() {
  await loadEnv()
  return createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

export function timestampToIso(value) {
  if (!value) return undefined
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value?.toDate) return value.toDate().toISOString()
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  if (typeof value === 'object' && Number.isFinite(value.seconds)) {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1000000)).toISOString()
  }
  return undefined
}

export function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.has(key) && !SENSITIVE_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, sanitize(item)]),
  )
}

export function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function chunk(items, size = 100) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
