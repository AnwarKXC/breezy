import 'server-only'

import { fleetMigrationStatus } from '@/generated/prisma/sql'
import { prisma } from '@/services/db/prisma'
import { fleetConfig } from './config'
import { getLicenseStatus } from './license'

// Report pulled by the control plane. Counts and versions only: no guest,
// financial or user data ever leaves the instance through this endpoint.

export async function getInstanceReport() {
  const { instanceId, appVersion } = fleetConfig()
  const startedAt = Date.now()

  const [[migrations], rooms, users, activeReservations, lastReservation, lastLogin, license] = await Promise.all([
    prisma.$queryRawTyped(fleetMigrationStatus()),
    // Same rule as the room limit: deleted rooms do not count.
    prisma.rooms.count({ where: { deleted_at: null } }),
    prisma.users.count({ where: { is_active: true } }),
    prisma.reservations.count({ where: { status: { in: ['confirmed', 'checked_in'] } } }),
    prisma.reservations.findFirst({ orderBy: { created_at: 'desc' }, select: { created_at: true } }),
    prisma.users.aggregate({ _max: { last_login_at: true } }),
    getLicenseStatus(),
  ])

  return {
    instanceId,
    version: appVersion,
    uptimeSeconds: Math.round(process.uptime()),
    db: {
      latencyMs: Date.now() - startedAt,
      migrationsApplied: Number(migrations.applied),
      migrationsFailed: Number(migrations.failed),
      latestMigration: migrations.latest,
    },
    usage: {
      rooms,
      activeUsers: users,
      activeReservations,
      lastReservationAt: lastReservation?.created_at.toISOString() ?? null,
      lastLoginAt: lastLogin._max.last_login_at?.toISOString() ?? null,
    },
    license,
  }
}
