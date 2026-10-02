import 'server-only'

import { compactVerify, importSPKI } from 'jose'

import { prisma } from '@/services/db/prisma'
import { fleetConfig } from './config'

// A license is an EdDSA-signed JWT issued by the control plane:
//   { iss: 'breezy-control', sub: <FLEET_INSTANCE_ID>, exp, plan, grace_days? }
// It is verified offline with the control plane's public key, so a control-plane
// outage never locks a hotel out. The control plane pushes renewals to
// PUT /api/system/license; FLEET_LICENSE_KEY seeds a fresh install.

const LICENSE_KEY = 'fleet_license'
const ISSUER = 'breezy-control'
const DEFAULT_GRACE_DAYS = 14
const CACHE_MS = 60_000
const DAY_MS = 24 * 60 * 60 * 1000

export type LicenseState = 'unmanaged' | 'active' | 'grace' | 'expired' | 'invalid' | 'missing'

export interface LicenseStatus {
  state: LicenseState
  /** Writes are blocked (expired beyond grace, invalid or missing license). */
  readOnly: boolean
  plan: string | null
  expiresAt: string | null
  /** Grace end; only set while in grace. */
  readOnlyAt: string | null
}

interface LicenseClaims {
  iss?: unknown
  sub?: unknown
  exp?: unknown
  plan?: unknown
  grace_days?: unknown
}

interface LicenseClaimsVerified {
  exp: number
  plan: string | null
  graceDays: number
}

type Verified = { ok: true; claims: LicenseClaimsVerified } | { ok: false }

const UNMANAGED: LicenseStatus = { state: 'unmanaged', readOnly: false, plan: null, expiresAt: null, readOnlyAt: null }

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
        plan: typeof claims.plan === 'string' ? claims.plan : null,
        graceDays: typeof claims.grace_days === 'number' && claims.grace_days >= 0 ? claims.grace_days : DEFAULT_GRACE_DAYS,
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
  if (!token) return { state: 'missing', readOnly: true, plan: null, expiresAt: null, readOnlyAt: null }

  const verified = await verifyLicenseToken(token)
  if (!verified.ok) return { state: 'invalid', readOnly: true, plan: null, expiresAt: null, readOnlyAt: null }

  return licenseStatusAt(verified.claims, now)
}

export function licenseStatusAt(claims: LicenseClaimsVerified, now: number): LicenseStatus {
  const { exp, plan, graceDays } = claims
  const expiresAt = exp * 1000
  const graceEnd = expiresAt + graceDays * DAY_MS
  const base = { plan, expiresAt: new Date(expiresAt).toISOString() }
  if (now < expiresAt) return { ...base, state: 'active', readOnly: false, readOnlyAt: null }
  if (now < graceEnd) return { ...base, state: 'grace', readOnly: false, readOnlyAt: new Date(graceEnd).toISOString() }
  return { ...base, state: 'expired', readOnly: true, readOnlyAt: null }
}

// Checked by the proxy on every API write, so cache per process. Instances
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
