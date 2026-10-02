import test from 'node:test'
import assert from 'node:assert/strict'
import { exportSPKI, generateKeyPair, SignJWT } from 'jose'
import { licenseStatusAt, verifyLicenseToken } from './license'

const DAY = 24 * 60 * 60 * 1000

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })
  process.env.FLEET_INSTANCE_ID = 'hotel-a'
  process.env.FLEET_LICENSE_PUBLIC_KEY = (await exportSPKI(publicKey)).replace(/\n/g, '\\n')
  const sign = (claims: { sub?: string; iss?: string; exp: number }) =>
    new SignJWT({ plan: 'standard', grace_days: 7 })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuer(claims.iss ?? 'breezy-control')
      .setSubject(claims.sub ?? 'hotel-a')
      .setExpirationTime(claims.exp)
      .sign(privateKey)
  return { sign }
}

test('accepts a signed license for this instance, even when expired', async () => {
  const { sign } = await setup()
  const expired = Math.floor((Date.now() - 30 * DAY) / 1000)
  const verified = await verifyLicenseToken(await sign({ exp: expired }))
  assert.deepEqual(verified, { ok: true, claims: { exp: expired, plan: 'standard', graceDays: 7 } })
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
  const claims = { exp: now / 1000, plan: 'standard', graceDays: 7 }
  assert.equal(licenseStatusAt(claims, now - 1).state, 'active')
  const grace = licenseStatusAt(claims, now + DAY)
  assert.equal(grace.state, 'grace')
  assert.equal(grace.readOnly, false)
  assert.equal(grace.readOnlyAt, new Date(now + 7 * DAY).toISOString())
  const expired = licenseStatusAt(claims, now + 7 * DAY)
  assert.equal(expired.state, 'expired')
  assert.equal(expired.readOnly, true)
})
