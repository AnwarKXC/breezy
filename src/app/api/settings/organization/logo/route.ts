import { NextResponse } from 'next/server'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { MAX_FILE_BYTES } from '@/services/files/fileStore'
import { getBranding, removeOrganizationLogo, setOrganizationLogo } from '@/shared/branding/server'

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.SETTINGS_WRITE, async (session) => {
    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'files/missing_file' }, { status: 400 })
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'files/too_large' }, { status: 413 })

    try {
      await setOrganizationLogo(new Uint8Array(await file.arrayBuffer()), session.id)
      return NextResponse.json({ data: await getBranding() }, { status: 201 })
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      if (code === 'files/unsupported_type') return NextResponse.json({ error: code }, { status: 415 })
      if (code === 'files/too_large') return NextResponse.json({ error: code }, { status: 413 })
      return NextResponse.json({ error: 'files/upload_failed' }, { status: 500 })
    }
  })
}

export async function DELETE(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.SETTINGS_WRITE, async (session) => {
    await removeOrganizationLogo(session.id)
    return NextResponse.json({ data: await getBranding() })
  })
}
