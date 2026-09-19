// 📁 src/app/[locale]/(dashboard)/users/[id]/UserDetailsView.tsx - User Details View Component

'use client'

import { useRouter } from 'next/navigation'
import { memo, useMemo } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useCurrency } from '@/shared/contexts/CurrencyContext'

import type { Locale } from '@/i18n/config'
import type { UserRole } from '@/modules/users/types'
import { Table, type TableColumn } from '@/shared/table'

// 📍 Placeholder types
const NO_DETAILS: Record<string, string> = {}

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

/** Totals over all of the user's reservations (the table only lists the latest). */
export interface ReservationStats {
  total: number
  /** Sum of non-cancelled reservation totals, in the system currency. */
  revenue: number
  lastCheckIn: string | null
}

interface UserDetailsViewProps {
  user: SerializableUser | null
  locale: Locale
  labels: Record<string, unknown>
  reservations: Reservation[]
  stats: ReservationStats
}

function UserInfoCard({ user, labels }: { user: SerializableUser | null; labels: Record<string, unknown> }) {
  const details = (labels.details ?? NO_DETAILS) as Record<string, string>
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

function ReservationsTable({ reservations, total, locale, labels }: { reservations: Reservation[]; total: number; locale: Locale; labels: Record<string, unknown> }) {
  const { formatCurrency } = useCurrency()
  const details = (labels.details ?? NO_DETAILS) as Record<string, string>
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
      render: (_value, reservation) => formatCurrency(reservation.totalPrice),
    },
  ], [details, formatCurrency, t])

  return (
    <div className="rounded-xl bg-white p-6 ">
      <h2 className="mb-4 text-lg font-bold text-[#1A1A1A]">{details.reservations || 'Reservations'}</h2>
      {total > reservations.length && (
        <p className="-mt-2 mb-4 text-sm text-[#787774]">
          {(details.showingLatest ?? '')
            .replace('{shown}', String(reservations.length))
            .replace('{total}', String(total))}
        </p>
      )}
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

function AnalyticsCards({ stats, labels }: { stats: ReservationStats; labels: Record<string, unknown> }) {
  const details = (labels.details ?? NO_DETAILS) as Record<string, string>
  const { formatCurrency } = useCurrency()

  const cards = [
    { label: details.totalBookings || 'Total Reservations', value: stats.total.toString(), icon: '📅' },
    { label: details.totalSpent || 'Total Spent', value: formatCurrency(stats.revenue), icon: '💰' },
    { label: details.lastBooking || 'Last Reservation', value: stats.lastCheckIn ?? '-', icon: '📆' },
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
  stats,
}: UserDetailsViewProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const details = (labels.details ?? NO_DETAILS) as Record<string, string>

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
        <AnalyticsCards stats={stats} labels={labels} />

        {/* User Info */}
        <UserInfoCard user={user} labels={labels} />

        {/* Reservations Table */}
        <ReservationsTable reservations={reservations} total={stats.total} locale={locale} labels={labels} />
      </div>
    </main>
  )
})
