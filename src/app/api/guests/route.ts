import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { toRows } from '@/services/db/rows'

const MAX_GUESTS = 500

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.GUESTS_READ, async () => {
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit')) || 200, 1), MAX_GUESTS)
    const rows = await prisma.guests.findMany({ where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: limit })
    return NextResponse.json({ data: toRows('guests', rows) })
  })
}
