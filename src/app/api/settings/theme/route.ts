import { NextResponse } from 'next/server'
import { z } from 'zod'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { zodErrorMessage } from '@/shared/validation'
import { normalizeHexColor } from '@/shared/theme/theme'
import { resetAppTheme, saveAppTheme } from '@/shared/theme/server'

const ThemeUpdateSchema = z.object({
  primaryColor: z.string().transform((value, ctx) => {
    const hex = normalizeHexColor(value)
    if (!hex) {
      ctx.addIssue({ code: 'custom', message: 'primaryColor must be a #RRGGBB hex color' })
      return z.NEVER
    }
    return hex
  }),
})

export async function PUT(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.SETTINGS_WRITE, async (session) => {
    const parsed = ThemeUpdateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    await saveAppTheme(parsed.data.primaryColor, session.id)
    return NextResponse.json({ data: { primaryColor: parsed.data.primaryColor, isDefault: false } })
  })
}

export async function DELETE(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.SETTINGS_WRITE, async () => {
    await resetAppTheme()
    return NextResponse.json({ data: { isDefault: true } })
  })
}
