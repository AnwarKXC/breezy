// 📁 src/app/[locale]/(dashboard)/users/[id]/page.tsx - User Details Page Server Component

import { UserDetailsView } from './UserDetailsView'
import { getUserById } from '@/modules/users/services/userService'
import { logUserViewed } from '@/modules/users/services/activityLogService'
import { getCurrentSession } from '@/modules/users/services/authSession'
import { checkLocale } from '@/i18n/config'
import { prisma } from '@/services/db/prisma'
import ar from '@/i18n/locales/ar.json'
import en from '@/i18n/locales/en.json'

const translations = { ar, en }

interface Reservation {
  id: string
  userId: string
  roomNumber: string
  checkIn: string
  checkOut: string
  status: string
  totalPrice: number
}

function UserDetailsErrorState({ error, label }: { error: string; label: string }) {
  return (
    <main className="min-h-screen bg-[#F4F5F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-xl bg-white p-10 text-center ">
        <h1 className="text-base font-medium text-[#1A1A1A]">{label}</h1>
        <p className="mt-2 text-sm text-[#787774]">{error}</p>
      </div>
    </main>
  )
}

export default async function UserDetailsRoutePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale: rawLocale, id } = await params
  const locale = checkLocale(rawLocale)
  const labels = translations[locale].users
  let user = null
  let errorMessage: string | null = null

  // Fetched alongside the user instead of after it (only used when the user exists).
  const reservationsPromise = prisma.reservations.findMany({
    where: { created_by: id, deleted_at: null },
    select: { id: true, created_by: true, reservation_number: true, check_in_date: true, check_out_date: true, status: true, total_amount: true },
    orderBy: { created_at: 'desc' },
  })
  reservationsPromise.catch(() => undefined)

  try {
    user = await getUserById(id).catch(() => null)

    // Log VIEW_USER_DETAILS analytics (fire-and-forget, don't block rendering)
    if (user) {
      getCurrentSession()
        .then(session => {
          logUserViewed({ actor: session, targetUserId: id })
        })
        .catch(() => undefined) // Silently fail - don't block page render
    }
  } catch (error) {
    errorMessage = (error as Error).message
  }

  if (errorMessage) {
    return <UserDetailsErrorState error={errorMessage} label={labels.errorTitle} />
  }

  // Convert Firestore Timestamp to ISO string for Client Components serialization
  const serializableUser = user ? {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    createdAt: user.createdAt
      ? new Date(user.createdAt.seconds * 1000).toISOString()
      : null,
  } : null

  let reservations: Reservation[] = []

  if (serializableUser) {
    const dbReservations = await reservationsPromise

    reservations = dbReservations.map((r) => ({
      id: r.id,
      userId: r.created_by,
      roomNumber: r.reservation_number,
      checkIn: r.check_in_date.toISOString().slice(0, 10),
      checkOut: r.check_out_date.toISOString().slice(0, 10),
      status: r.status,
      totalPrice: Number(r.total_amount),
    }))
  }

  return (
    <UserDetailsView
      user={serializableUser}
      locale={locale}
      labels={labels}
      reservations={reservations}
    />
  )
}
