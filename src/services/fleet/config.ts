import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'

// Fleet = this hotel install as one managed instance of the control plane.
// With FLEET_LICENSE_PUBLIC_KEY unset the instance is "unmanaged": no license
// enforcement (local dev, demo installs).
export function fleetConfig() {
  return {
    instanceId: process.env.FLEET_INSTANCE_ID || null,
    instanceSecret: process.env.FLEET_INSTANCE_SECRET || null,
    // PEM may arrive with literal "\n" when set through a hosting dashboard.
    publicKeyPem: process.env.FLEET_LICENSE_PUBLIC_KEY?.replace(/\\n/g, '\n') || null,
    bootstrapLicense: process.env.FLEET_LICENSE_KEY || null,
    appVersion: process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  }
}

/** True when the request carries `Authorization: Bearer <FLEET_INSTANCE_SECRET>`. */
export function isControlPlaneRequest(request: Request): boolean {
  const secret = fleetConfig().instanceSecret
  const header = request.headers.get('authorization')
  if (!secret || !header?.startsWith('Bearer ')) return false
  // Hash both sides so the comparison is constant-time regardless of length.
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(header.slice(7)), digest(secret))
}
