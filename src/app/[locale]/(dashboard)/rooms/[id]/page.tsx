import { checkLocale } from '@/i18n/config'
import { ACTIONS } from '@/config/rbac'
import { enforceActionAccess } from '@/shared/rbac/requireModuleAccess'
import { RoomDetailPage } from '@/modules/rooms/components/RoomDetailPage'

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params
  const locale = checkLocale(rawLocale)
  await enforceActionAccess(ACTIONS.ROOMS_READ, locale, `/${locale}/rooms/${id}`)

  return <RoomDetailPage />
}
