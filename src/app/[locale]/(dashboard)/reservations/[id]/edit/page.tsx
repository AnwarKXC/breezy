import { checkLocale } from '@/i18n/config'
import { ACTIONS } from '@/config/rbac'
import { enforceActionAccess } from '@/shared/rbac/requireModuleAccess'
import { ReservationEditPage } from '@/modules/reservations/components/ReservationEditPage'

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params
  const locale = checkLocale(rawLocale)
  await enforceActionAccess(ACTIONS.RESERVATIONS_UPDATE_DRAFT, locale, `/${locale}/reservations/${id}/edit`)

  return <ReservationEditPage />
}
