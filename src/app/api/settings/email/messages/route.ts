import { NextResponse } from 'next/server'
import { z } from 'zod'
import { secureMutationEndpoint, secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { zodErrorMessage } from '@/shared/validation'
import { listMessages, sendMessage } from '@/services/email/mailbox'
import { FolderSchema, mailErrorResponse } from '../errors'

const PAGE_SIZE = 25
/** ~10 MB of attachments once base64 is decoded. */
const MAX_ATTACHMENT_BASE64 = 14_000_000

const emailList = z.array(z.email().trim().max(254)).max(50)

const SendSchema = z
  .object({
    to: emailList.min(1),
    cc: emailList.default([]),
    subject: z.string().trim().max(500),
    text: z.string().max(200_000),
    inReplyTo: z.string().max(998).optional(),
    references: z.array(z.string().max(998)).max(100).optional(),
    attachments: z
      .array(
        z.object({
          filename: z.string().trim().min(1).max(255),
          contentType: z.string().trim().max(255).default('application/octet-stream'),
          content: z.base64(),
        }),
      )
      .max(10)
      .default([]),
  })
  .refine((mail) => mail.attachments.reduce((sum, a) => sum + a.content.length, 0) <= MAX_ATTACHMENT_BASE64, {
    message: 'email/attachments_too_large',
    path: ['attachments'],
  })

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.SETTINGS_READ, async () => {
    const params = new URL(request.url).searchParams
    const folder = FolderSchema.parse(params.get('folder'))
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
  return secureMutationEndpoint(request, ACTIONS.SETTINGS_WRITE, async () => {
    const parsed = SendSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    try {
      await sendMessage(parsed.data)
      return NextResponse.json({ data: { sent: true } })
    } catch (error) {
      return mailErrorResponse(error)
    }
  })
}
