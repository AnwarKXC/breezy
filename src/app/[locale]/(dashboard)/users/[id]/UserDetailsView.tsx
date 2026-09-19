// 📁 src/app/[locale]/(dashboard)/users/[id]/UserDetailsView.tsx - User Details View Component

'use client'

import { useRouter } from 'next/navigation'
import { memo, useMemo } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'

import type { Locale } from '@/i18n/config'
import type { UserRole } from '@/modules/users/types'
import { Table, type TableColumn } from '@/shared/table'

// 📍 Placeholder types
interface Reservation {
  id: string
  userId: string
  roomNumber: string
  checkIn: string
  checkOut: string
  status: string
  totalPrice: number
}

// 📍 Client-safe user type (createdAt is ISO string, not Timestamp)
interface SerializableUser {
  id: string
  name: string
  email: string
  role: UserRole
  phone?: string | null
  createdAt: string | null
}

interface UserDetailsViewProps {
  user: SerializableUser | null
  locale: Locale
  labels: Record<string, unknown>
  reservations: Reservation[]
}

function UserInfoCard({ user, locale, labels }: { user: SerializableUser | null; locale: Locale; labels: Record<string, unknown> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details = (labels as any).details || {}
  const { t } = useTranslation()
  const roleKey = user?.role === 'front_desk' ? 'frontDesk' : (user?.role as string) ?? ''
  const translatedRole = roleKey ? ((labels.roles as Record<string, string>)?.[roleKey] ?? user?.role) : ''

  if (!user) {
    return (
      <div className="rounded-xl bg-white p-6 ">
        <h2 className="mb-4 text-lg font-bold text-[#1A1A1A]">{details.info || 'User Information'}</h2>
        <p className="text-sm text-[#787774]">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white p-6 ">
      <h2 className="mb-4 text-lg font-bold text-[#1A1A1A]">{details.info || 'User Information'}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-[#787774]">{t('common.name')}</p>
          <p className="font-medium text-[#1A1A1A]">{user.name}</p>
        </div>
        <div>
          <p className="text-xs text-[#787774]">{t('common.email')}</p>
          <p className="font-medium text-[#1A1A1A]">{user.email}</p>
        </div>
        <div>
          <p className="text-xs text-[#787774]">{t('common.phone')}</p>
          <p className="font-medium text-[#1A1A1A]">{user.phone}</p>
        </div>
        <div>
          <p className="text-xs text-[#787774]">{t('common.role')}</p>
          <span className="mt-1 inline-block rounded-full bg-[#F9F9F8] px-3 py-1 text-xs font-bold text-[#555555]">
            {translatedRole}
          </span>
        </div>
      </div>
    </div>
  )
}

type ReservationRow = Reservation & Record<string, unknown>

function ReservationsTable({ reservations, locale, labels }: { reservations: Reservation[]; locale: Locale; labels: Record<string, unknown> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details = (labels as any).details || {}
  const router = useRouter()
  const { t } = useTranslation()
  const getStatusColor = (status: Reservation['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-700'
      case 'checked_in':
        return 'bg-blue-100 text-blue-700'
      case 'checked_out':
        return 'bg-[#F5F5F5] text-[#333333]'
      case 'cancelled':
        return 'bg-[#FDEBEC] text-[#9F2F2D]'
      default:
        return 'bg-[#F5F5F5] text-[#333333]'
    }
  }

  const columns = useMemo<TableColumn<ReservationRow>[]>(() => [
    { key: 'roomNumber', label: details.reservation || 'Reservation' },
    { key: 'checkIn', label: details.checkIn || 'Check In' },
    { key: 'checkOut', label: details.checkOut || 'Check Out' },
    {
      key: 'status',
      label: t('common.status'),
      render: (_value, reservation) => (
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(reservation.status)}`}>
          {reservation.status}
        </span>
      ),
    },
    {
      key: 'totalPrice',
      label: details.total || 'Total',
      render: (_value, reservation) => `$${reservation.totalPrice}`,
    },
  ], [details, t])

  return (
    <div className="rounded-xl bg-white p-6 ">
      <h2 className="mb-4 text-lg font-bold text-[#1A1A1A]">{details.reservations || 'Reservations'}</h2>
      <Table
        columns={columns}
        data={reservations as ReservationRow[]}
        pageSize={5}
        pageSizeOptions={[5, 10, 20]}
        sortable={false}
        onRowClick={(row) => {
          const r = row as unknown as Reservation
          router.push(`/${locale}/reservations/${r.id}`)
        }}
      />
    </div>
  )
}

function AnalyticsCards({
  reservations,
  labels,
}: {
  reservations: Reservation[]
  labels: Record<string, unknown>
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details = (labels as any).details || {}
  const totalReservations = reservations.length
  const totalRevenue = reservations
    .filter((r) => r.status !== 'cancelled')
    .reduce((sum, r) => sum + r.totalPrice, 0)
  const lastBooking = reservations
    .filter((r) => r.status !== 'cancelled')
    .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime())[0]

  const cards = [
    { label: details.totalBookings || 'Total Bookings', value: totalReservations.toString(), icon: '📅' },
    { label: details.totalSpent || 'Total Spent', value: `$${totalRevenue.toLocaleString()}`, icon: '💰' },
    { label: details.lastBooking || 'Last Booking', value: lastBooking?.checkIn || '-', icon: '📆' },
  ]

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-xl border border-[#EAEAEA] bg-white p-6 "
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{card.label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#1A1A1A]">
            {card.icon} {card.value}
          </p>
        </article>
      ))}
    </section>
  )
}

export const UserDetailsView = memo(function UserDetailsViewComponent({
  user,
  locale,
  labels,
  reservations,
}: UserDetailsViewProps) {
  const router = useRouter()
  const { t } = useTranslation()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details = (labels as any).details || {}

  return (
    <main className="min-h-screen bg-[#F4F5F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EAEAEA] bg-white text-[#555555] transition-colors hover:bg-[#F9F9F8]"
            aria-label={t('common.back')}
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-[#1A1A1A]">
            {details.title || 'User Details'}
          </h1>
        </div>

        {/* Analytics Cards */}
        <AnalyticsCards reservations={reservations} labels={labels} />

        {/* User Info */}
        <UserInfoCard user={user} locale={locale} labels={labels} />

        {/* Reservations Table */}
        <ReservationsTable reservations={reservations} locale={locale} labels={labels} />
      </div>
    </main>
  )
})
