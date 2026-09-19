import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import { checkLocale } from '@/i18n/config'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ReservationDetailPage = dynamic(() => import('@/modules/reservations/components/ReservationDetailPage').then(m => m.ReservationDetailPage), {
  loading: () => <PageSkeleton />,
})

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7F6F3] px-4 py-6 sm:px-6 lg:px-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[#EAEAEA]" />
        <div className="h-64 rounded-xl bg-white" />
      </div>
    </div>
  )
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params
  const locale = checkLocale(rawLocale)

  if (!UUID_RE.test(id)) {
    redirect(id === 'new' ? `/${locale}/reservations/new` : `/${locale}/reservations`)
  }

  return <ReservationDetailPage />
}
