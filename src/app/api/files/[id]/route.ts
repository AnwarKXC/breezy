import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/actionPermissions'
import { secureMutationEndpoint, secureReadEndpoint } from '@/shared/secureEndpoint'
import { deleteFile, getFile } from '@/services/files/fileStore'

type Context = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request, { params }: Context) {
  return secureReadEndpoint(request, ACTIONS.CONTACTS_READ, async () => {
    const { id } = await params
    if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const file = await getFile(id)
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Files are immutable (a new upload gets a new id), so cache aggressively.
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        'Content-Type': file.content_type,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })
}

export async function DELETE(request: Request, { params }: Context) {
  return secureMutationEndpoint(request, ACTIONS.CONTACTS_UPDATE, async () => {
    const { id } = await params
    if (UUID.test(id)) await deleteFile(id)
    return NextResponse.json({ success: true })
  })
}
