import { NextResponse } from 'next/server'
import { z } from 'zod'
import { secureMutationEndpoint, secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { zodErrorMessage } from '@/shared/validation'
import { listMessages, sendMessage, updateMessages } from '@/services/email/mailbox'
import { SendSchema, BulkSchema } from '@/services/email/contracts'
import { FolderSchema, mailErrorResponse } from '../errors'

const PAGE_SIZE = 25

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.EMAIL_READ, async () => {
    const params = new URL(request.url).searchParams
    const parsedFolder = FolderSchema.safeParse(params.get('folder'))
    if (!parsedFolder.success) return NextResponse.json({ error: 'email/invalid_folder' }, { status: 400 })
    const folder = parsedFolder.data
    const page = z.coerce.number().int().min(1).max(10_000).catch(1).parse(params.get('page'))
    const search = (params.get('q') ?? '').trim().slice(0, 200)
    try {
      const result = await listMessages(folder, { page, pageSize: PAGE_SIZE, search })
      return NextResponse.json({ data: { ...result, page, pageSize: PAGE_SIZE } })
    } catch (error) {
      return mailErrorResponse(error)
    }
  })
}

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.EMAIL_WRITE, async () => {
    const parsed = SendSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    try {
      const result = await sendMessage(parsed.data)
      return NextResponse.json({ data: { sent: true, ...result } })
    } catch (error) {
      return mailErrorResponse(error)
    }
  })
}

export async function PATCH(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.EMAIL_WRITE, async () => {
    const parsed = BulkSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    try {
      await updateMessages(parsed.data.folder, parsed.data.uids, parsed.data.action)
      return NextResponse.json({ data: { updated: parsed.data.uids.length } })
    } catch (error) { return mailErrorResponse(error) }
  })
}
