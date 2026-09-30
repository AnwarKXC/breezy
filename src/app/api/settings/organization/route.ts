import { NextResponse } from 'next/server'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { zodErrorMessage } from '@/shared/validation'
import { OrganizationUpdateSchema } from '@/shared/branding/schema'
import { getBranding, resetOrganization, saveOrganizationDetails } from '@/shared/branding/server'

export async function PUT(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.SETTINGS_WRITE, async (session) => {
    const parsed = OrganizationUpdateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    await saveOrganizationDetails(parsed.data, session.id)
    return NextResponse.json({ data: await getBranding() })
  })
}

/** Reset to defaults: clears every field and deletes the custom logo. */
export async function DELETE(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.SETTINGS_WRITE, async () => {
    await resetOrganization()
    return NextResponse.json({ data: await getBranding() })
  })
}
