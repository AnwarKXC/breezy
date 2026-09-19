import { NextResponse } from 'next/server'
import { secureReadEndpoint, secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getAccountingSettings, updateAccountingSetting } from '@/modules/accounting/services'
import { AccountingSettingsUpdateSchema, zodErrorMessage } from '@/shared/validation'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const data = await getAccountingSettings()
    return NextResponse.json({ data })
  })
}

export async function PATCH(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.ACCOUNTING_SETTINGS, async () => {
    const parsed = AccountingSettingsUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    await updateAccountingSetting(parsed.data.key, parsed.data.value)
    return NextResponse.json({ message: 'Setting updated' })
  })
}
