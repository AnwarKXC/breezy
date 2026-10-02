import { NextResponse } from 'next/server'
import { z } from 'zod'
import { secureMutationEndpoint, secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { zodErrorMessage } from '@/shared/validation'
import { deleteMessage, getMessage, setMessageFlags } from '@/services/email/mailbox'
import { FolderSchema, UidSchema, mailErrorResponse } from '../../errors'

interface MessageRouteContext {
  params: Promise<{ uid: string }>
}

const FlagsSchema = z
  .object({ seen: z.boolean().optional(), flagged: z.boolean().optional() })
  .refine((flags) => flags.seen !== undefined || flags.flagged !== undefined, 'No flag to change')

async function target(request: Request, context: MessageRouteContext) {
  const uid = UidSchema.safeParse((await context.params).uid)
  const folder = FolderSchema.safeParse(new URL(request.url).searchParams.get('folder'))
  return uid.success && folder.success && folder.data !== 'pinned' ? { uid: uid.data, folder: folder.data } : null
}

const notFound = () => NextResponse.json({ error: 'email/message_not_found' }, { status: 404 })

export async function GET(request: Request, context: MessageRouteContext) {
  return secureReadEndpoint(request, ACTIONS.EMAIL_READ, async () => {
    const t = await target(request, context)
    if (!t) return notFound()
    try {
      const message = await getMessage(t.folder, t.uid)
      return message ? NextResponse.json({ data: message }) : notFound()
    } catch (error) {
      return mailErrorResponse(error)
    }
  })
}

export async function PATCH(request: Request, context: MessageRouteContext) {
  return secureMutationEndpoint(request, ACTIONS.EMAIL_WRITE, async () => {
    const t = await target(request, context)
    if (!t) return notFound()
    const parsed = FlagsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    try {
      await setMessageFlags(t.folder, t.uid, parsed.data)
      return NextResponse.json({ data: parsed.data })
    } catch (error) {
      return mailErrorResponse(error)
    }
  })
}

export async function DELETE(request: Request, context: MessageRouteContext) {
  return secureMutationEndpoint(request, ACTIONS.EMAIL_WRITE, async () => {
    const t = await target(request, context)
    if (!t) return notFound()
    try {
      await deleteMessage(t.folder, t.uid)
      return NextResponse.json({ data: null })
    } catch (error) {
      return mailErrorResponse(error)
    }
  })
}
