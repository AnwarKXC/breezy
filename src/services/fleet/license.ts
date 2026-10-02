import 'server-only'

import { compactVerify, importSPKI } from 'jose'

import { prisma } from '@/services/db/prisma'
import { fleetConfig } from './config'

// A license is an EdDSA-signed JWT issued by the control plane:
//   { iss: 'breezy-control', sub: <FLEET_INSTANCE_ID>, iat, exp, plan, grace_days?,
//     mode?: 'active' | 'read_only' | 'locked', max_rooms?, max_users? }
// It is verified offline with the control plane's public key, so a control-plane
// outage never locks a hotel out. The control plane pushes renewals to
// PUT /api/system/license; FLEET_LICENSE_KEY seeds a fresh install.
// Mode and limits live inside the signed token, so a hotel cannot change its own.

const LICENSE_KEY = 'fleet_license'
const ISSUER = 'breezy-control'
const DEFAULT_GRACE_DAYS = 14
const CACHE_MS = 60_000
const DAY_MS = 24 * 60 * 60 * 1000

export type LicenseState = 'unmanaged' | 'active' | 'grace' | 'expired' | 'suspended' | 'locked' | 'invalid' | 'missing'
export type LicenseMode = 'active' | 'read_only' | 'locked'

export interface LicenseLimits {
  maxRooms: number | null
  maxUsers: number | null
}

export interface LicenseStatus {
  state: LicenseState
  /** Writes are blocked (expired beyond grace, suspended, locked, invalid or missing license). */
  readOnly: boolean
  /** The whole app is closed (locked by the provider); only the paused page is served. */
  locked: boolean
  plan: string | null
  expiresAt: string | null
  /** Grace end; only set while in grace. */
  readOnlyAt: string | null
  /** When the license in force was issued; the control plane compares it to detect a stale copy. */
  issuedAt: string | null
  limits: LicenseLimits
}

interface LicenseClaims {
  iss?: unknown
  sub?: unknown
  iat?: unknown
  exp?: unknown
  plan?: unknown
  grace_days?: unknown
  mode?: unknown
  max_rooms?: unknown
  max_users?: unknown
}

interface LicenseClaimsVerified {
  exp: number
  iat: number | null
  plan: string | null
  graceDays: number
  mode: LicenseMode
  limits: LicenseLimits
}

type Verified = { ok: true; claims: LicenseClaimsVerified } | { ok: false }

const NO_LIMITS: LicenseLimits = { maxRooms: null, maxUsers: null }
const blocked = (state: LicenseState): LicenseStatus => ({
  state,
  readOnly: true,
  locked: false,
  plan: null,
  expiresAt: null,
  readOnlyAt: null,
  issuedAt: null,
  limits: NO_LIMITS,
})
const UNMANAGED: LicenseStatus = { ...blocked('unmanaged'), readOnly: false }

const positiveInt = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null)

export async function verifyLicenseToken(token: string): Promise<Verified> {
  const { publicKeyPem, instanceId } = fleetConfig()
  if (!publicKeyPem) return { ok: false }
  try {
    const key = await importSPKI(publicKeyPem, 'EdDSA')
    // compactVerify checks only the signature; expiry is evaluated by the caller
    // so an expired license still yields its grace window.
    const { payload } = await compactVerify(token, key, { algorithms: ['EdDSA'] })
    const claims = JSON.parse(new TextDecoder().decode(payload)) as LicenseClaims
    if (claims.iss !== ISSUER || claims.sub !== instanceId || typeof claims.exp !== 'number') return { ok: false }
    return {
      ok: true,
      claims: {
        exp: claims.exp,
        iat: typeof claims.iat === 'number' ? claims.iat : null,
        plan: typeof claims.plan === 'string' ? claims.plan : null,
        graceDays: typeof claims.grace_days === 'number' && claims.grace_days >= 0 ? claims.grace_days : DEFAULT_GRACE_DAYS,
        // Unknown modes fail closed to read-only rather than open.
        mode: claims.mode === undefined || claims.mode === 'active' ? 'active' : claims.mode === 'locked' ? 'locked' : 'read_only',
        limits: { maxRooms: positiveInt(claims.max_rooms), maxUsers: positiveInt(claims.max_users) },
      },
    }
  } catch {
    return { ok: false }
  }
}

async function storedToken(): Promise<string | null> {
  const row = await prisma.app_settings.findUnique({ where: { key: LICENSE_KEY }, select: { value: true } })
  const token = (row?.value as { token?: unknown } | null)?.token
  return typeof token === 'string' ? token : fleetConfig().bootstrapLicense
}

async function computeStatus(now = Date.now()): Promise<LicenseStatus> {
  const { publicKeyPem } = fleetConfig()
  if (!publicKeyPem) return UNMANAGED

  const token = await storedToken()
  if (!token) return blocked('missing')

  const verified = await verifyLicenseToken(token)
  if (!verified.ok) return blocked('invalid')

  return licenseStatusAt(verified.claims, now)
}

export function licenseStatusAt(claims: LicenseClaimsVerified, now: number): LicenseStatus {
  const { exp, iat, plan, graceDays, mode, limits } = claims
  const expiresAt = exp * 1000
  const graceEnd = expiresAt + graceDays * DAY_MS
  const base = {
    plan,
    expiresAt: new Date(expiresAt).toISOString(),
    issuedAt: iat === null ? null : new Date(iat * 1000).toISOString(),
    limits,
    locked: false,
    readOnlyAt: null,
  }
  // Provider decisions win over the calendar: a locked or paused hotel stays so until resumed.
  if (mode === 'locked') return { ...base, state: 'locked', readOnly: true, locked: true }
  if (mode === 'read_only') return { ...base, state: 'suspended', readOnly: true }
  if (now < expiresAt) return { ...base, state: 'active', readOnly: false }
  if (now < graceEnd) return { ...base, state: 'grace', readOnly: false, readOnlyAt: new Date(graceEnd).toISOString() }
  return { ...base, state: 'expired', readOnly: true }
}

// Checked by the proxy on every request it gates, so cache per process. Instances
// behind a load balancer pick up a pushed license within CACHE_MS.
const globalForLicense = globalThis as unknown as { fleetLicense?: { status: LicenseStatus; at: number } }

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const cached = globalForLicense.fleetLicense
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.status
  try {
    const status = await computeStatus()
    globalForLicense.fleetLicense = { status, at: Date.now() }
    return status
  } catch {
    // DB unreachable: keep the last known status rather than blocking or unblocking.
    return cached?.status ?? UNMANAGED
  }
}

/** Stores a control-plane-issued token after verifying it. Returns the new status, or null if rejected. */
export async function installLicense(token: string): Promise<LicenseStatus | null> {
  const verified = await verifyLicenseToken(token)
  if (!verified.ok) return null
  await prisma.app_settings.upsert({
    where: { key: LICENSE_KEY },
    create: { key: LICENSE_KEY, value: { token } },
    update: { value: { token }, updated_at: new Date() },
  })
  globalForLicense.fleetLicense = undefined
  return getLicenseStatus()
}
