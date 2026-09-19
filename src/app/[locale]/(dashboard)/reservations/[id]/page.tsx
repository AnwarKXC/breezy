import { ReservationDetailPage } from '@/modules/reservations/components/ReservationDetailPage'
import { redirect } from 'next/navigation'
import { checkLocale } from '@/i18n/config'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params
  const locale = checkLocale(rawLocale)

  if (!UUID_RE.test(id)) {
    redirect(id === 'new' ? `/${locale}/reservations/new` : `/${locale}/reservations`)
  }

  return <ReservationDetailPage />
}
