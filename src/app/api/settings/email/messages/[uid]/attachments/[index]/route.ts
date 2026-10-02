import { NextResponse } from 'next/server'
import { z } from 'zod'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getAttachment } from '@/services/email/mailbox'
import { FolderSchema, UidSchema, mailErrorResponse } from '../../../../errors'

interface AttachmentRouteContext {
  params: Promise<{ uid: string; index: string }>
}

export async function GET(request: Request, context: AttachmentRouteContext) {
  return secureReadEndpoint(request, ACTIONS.EMAIL_READ, async () => {
    const params = await context.params
    const uid = UidSchema.safeParse(params.uid)
    const index = z.coerce.number().int().min(0).max(1000).safeParse(params.index)
    const folder = FolderSchema.safeParse(new URL(request.url).searchParams.get('folder'))
    if (!uid.success || !index.success || !folder.success || folder.data === 'pinned') {
      return NextResponse.json({ error: 'email/attachment_not_found' }, { status: 404 })
    }
    try {
      const file = await getAttachment(folder.data, uid.data, index.data)
      if (!file) return NextResponse.json({ error: 'email/attachment_not_found' }, { status: 404 })
      // Always a download, never rendered inline: attachments are untrusted content.
      return new NextResponse(new Uint8Array(file.content), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        },
      })
    } catch (error) {
      return mailErrorResponse(error)
    }
  })
}
