// Fleet license tooling (runs on your machine / the control plane, never on a hotel instance).
//
//   pnpm fleet:license keygen
//     -> prints an Ed25519 key pair. Keep the private key secret (control plane only);
//        put the public key in every hotel's FLEET_LICENSE_PUBLIC_KEY.
//
//   FLEET_LICENSE_PRIVATE_KEY="<pem>" pnpm fleet:license issue <instanceId> <days> [plan] [graceDays]
//     -> prints a license token for FLEET_LICENSE_KEY or PUT /api/system/license.
import { exportPKCS8, exportSPKI, generateKeyPair, importPKCS8, SignJWT } from 'jose'

const ISSUER = 'breezy-control'

async function keygen() {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })
  console.log('# Control plane only:')
  console.log(`FLEET_LICENSE_PRIVATE_KEY="${(await exportPKCS8(privateKey)).trim().replace(/\n/g, '\\n')}"`)
  console.log('\n# Every hotel instance:')
  console.log(`FLEET_LICENSE_PUBLIC_KEY="${(await exportSPKI(publicKey)).trim().replace(/\n/g, '\\n')}"`)
}

async function issue(instanceId: string | undefined, days: string | undefined, plan = 'standard', graceDays = '14') {
  const pem = process.env.FLEET_LICENSE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!pem || !instanceId || !Number(days)) {
    throw new Error('Usage: FLEET_LICENSE_PRIVATE_KEY=... fleet-license issue <instanceId> <days> [plan] [graceDays]')
  }
  const key = await importPKCS8(pem, 'EdDSA')
  const token = await new SignJWT({ plan, grace_days: Number(graceDays) })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuer(ISSUER)
    .setSubject(instanceId)
    .setIssuedAt()
    .setExpirationTime(`${Number(days)}d`)
    .sign(key)
  console.log(token)
}

const [command, ...args] = process.argv.slice(2)
const run = command === 'keygen' ? keygen() : command === 'issue' ? issue(...(args as [string, string, string, string])) : null
if (!run) {
  console.error('Commands: keygen | issue <instanceId> <days> [plan] [graceDays]')
  process.exit(1)
}
run.catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
