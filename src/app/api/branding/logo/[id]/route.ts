import { NextResponse } from 'next/server'
import { getFile } from '@/services/files/fileStore'
import { getBrandingLogoFileId } from '@/shared/branding/server'

type Context = { params: Promise<{ id: string }> }

// Public, but only serves the file that is currently the organization logo,
// so it cannot be used to read other stored files.
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params
  if (id !== (await getBrandingLogoFileId())) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const file = await getFile(id)
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // A new upload gets a new id (and URL), so the content never changes.
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.content_type,
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
