import test from 'node:test'
import assert from 'node:assert/strict'
import { exportSPKI, generateKeyPair, SignJWT } from 'jose'
import { licenseStatusAt, verifyLicenseToken } from './license'

const DAY = 24 * 60 * 60 * 1000

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })
  process.env.FLEET_INSTANCE_ID = 'hotel-a'
  process.env.FLEET_LICENSE_PUBLIC_KEY = (await exportSPKI(publicKey)).replace(/\n/g, '\\n')
  const sign = (claims: { sub?: string; iss?: string; exp: number; extra?: Record<string, unknown> }) =>
    new SignJWT({ plan: 'standard', grace_days: 7, ...claims.extra })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuer(claims.iss ?? 'breezy-control')
      .setSubject(claims.sub ?? 'hotel-a')
      .setExpirationTime(claims.exp)
      .sign(privateKey)
  return { sign }
}

const claimsAt = (now: number, overrides: Partial<Parameters<typeof licenseStatusAt>[0]> = {}) => ({
  exp: now / 1000,
  iat: null,
  plan: 'standard',
  graceDays: 7,
  mode: 'active' as const,
  limits: { maxRooms: null, maxUsers: null },
  ...overrides,
})

test('accepts a signed license for this instance, even when expired', async () => {
  const { sign } = await setup()
  const expired = Math.floor((Date.now() - 30 * DAY) / 1000)
  const verified = await verifyLicenseToken(await sign({ exp: expired }))
  assert.deepEqual(verified, {
    ok: true,
    claims: { exp: expired, iat: null, plan: 'standard', graceDays: 7, mode: 'active', limits: { maxRooms: null, maxUsers: null } },
  })
})

test('reads mode and limits from the token; unknown modes fail closed', async () => {
  const { sign } = await setup()
  const exp = Math.floor(Date.now() / 1000) + 3600
  const limited = await verifyLicenseToken(await sign({ exp, extra: { mode: 'locked', max_rooms: 40, max_users: 5 } }))
  assert.ok(limited.ok)
  assert.equal(limited.claims.mode, 'locked')
  assert.deepEqual(limited.claims.limits, { maxRooms: 40, maxUsers: 5 })
  const odd = await verifyLicenseToken(await sign({ exp, extra: { mode: 'party', max_rooms: -3, max_users: 2.5 } }))
  assert.ok(odd.ok)
  assert.equal(odd.claims.mode, 'read_only')
  assert.deepEqual(odd.claims.limits, { maxRooms: null, maxUsers: null })
})

test('rejects another instance, another issuer, a foreign key and garbage', async () => {
  const { sign } = await setup()
  const exp = Math.floor(Date.now() / 1000) + 3600
  assert.equal((await verifyLicenseToken(await sign({ exp, sub: 'hotel-b' }))).ok, false)
  assert.equal((await verifyLicenseToken(await sign({ exp, iss: 'someone' }))).ok, false)
  const foreign = await sign({ exp })
  await setup() // rotates the configured public key
  assert.equal((await verifyLicenseToken(foreign)).ok, false)
  assert.equal((await verifyLicenseToken('not.a.jwt')).ok, false)
})

test('active, then grace, then read-only', () => {
  const now = Date.UTC(2026, 9, 2)
  const claims = claimsAt(now)
  assert.equal(licenseStatusAt(claims, now - 1).state, 'active')
  const grace = licenseStatusAt(claims, now + DAY)
  assert.equal(grace.state, 'grace')
  assert.equal(grace.readOnly, false)
  assert.equal(grace.readOnlyAt, new Date(now + 7 * DAY).toISOString())
  const expired = licenseStatusAt(claims, now + 7 * DAY)
  assert.equal(expired.state, 'expired')
  assert.equal(expired.readOnly, true)
})

test('paused and locked win over a valid expiry', () => {
  const now = Date.UTC(2026, 9, 2)
  const paused = licenseStatusAt(claimsAt(now + 300 * DAY, { mode: 'read_only' }), now)
  assert.deepEqual([paused.state, paused.readOnly, paused.locked], ['suspended', true, false])
  const locked = licenseStatusAt(claimsAt(now + 300 * DAY, { mode: 'locked' }), now)
  assert.deepEqual([locked.state, locked.readOnly, locked.locked], ['locked', true, true])
  // The real expiry date is kept, so resuming restores the same term.
  assert.equal(paused.expiresAt, new Date(now + 300 * DAY).toISOString())
})
