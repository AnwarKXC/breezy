import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/actionPermissions'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { MAX_FILE_BYTES, saveImage } from '@/services/files/fileStore'

// Image upload (contact logos). Stored in Postgres, served by /api/files/[id].
export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.CONTACTS_UPDATE, async (session) => {
    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'files/missing_file' }, { status: 400 })
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'files/too_large' }, { status: 413 })

    try {
      const saved = await saveImage(new Uint8Array(await file.arrayBuffer()), session.id)
      return NextResponse.json({ data: saved }, { status: 201 })
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      if (code === 'files/unsupported_type') return NextResponse.json({ error: code }, { status: 415 })
      if (code === 'files/too_large') return NextResponse.json({ error: code }, { status: 413 })
      return NextResponse.json({ error: 'files/upload_failed' }, { status: 500 })
    }
  })
}
