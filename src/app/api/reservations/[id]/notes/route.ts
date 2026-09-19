import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint, secureReadEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { toRow, toRows } from '@/services/db/rows'
import { ReservationNotesSchema, zodErrorMessage } from '@/shared/validation'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureReadEndpoint(request, ACTIONS.RESERVATIONS_READ, async () => {
    const { id } = await params
    const rows = await prisma.reservation_notes.findMany({ where: { reservation_id: id }, orderBy: { created_at: 'desc' } })
    return NextResponse.json({ ok: true, data: toRows('reservation_notes', rows) })
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_ADD_NOTE, async (session) => {
    const { id } = await params
    const parsed = ReservationNotesSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }

    try {
      const row = await prisma.reservation_notes.create({
        data: { reservation_id: id, message: parsed.data.body, visibility: parsed.data.visibility, created_by: session.id },
      })
      return NextResponse.json({ ok: true, data: toRow('reservation_notes', row) }, { status: 201 })
    } catch {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Failed to add note' } }, { status: 400 })
    }
  })
}
