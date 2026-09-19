// 📁 src/modules/users/components/UserDetailsPage.tsx - User Details Page Component

'use client'

import { memo, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import type { Locale } from '@/i18n/config'
import { AOS } from '@/shared/components/AOS'
import { Table, type TableColumn } from '@/shared/table'
import type { User } from '../types'

// Placeholder types - will be replaced with actual data
interface Reservation {
  id: string
  userId: string
  roomNumber: string
  checkIn: string
  checkOut: string
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  totalPrice: number
}

interface UserDetailsPageProps {
  user: User
  locale: Locale
  labels: Record<string, unknown>
}

// Placeholder reservations - in real implementation, this would come from a service
const PLACEHOLDER_RESERVATIONS: Reservation[] = [
  {
    id: 'res-001',
    userId: '',
    roomNumber: '101',
    checkIn: '2024-01-15',
    checkOut: '2024-01-18',
    status: 'checked_out',
    totalPrice: 450,
  },
  {
    id: 'res-002',
    userId: '',
    roomNumber: '205',
    checkIn: '2024-02-20',
    checkOut: '2024-02-25',
    status: 'checked_out',
    totalPrice: 750,
  },
  {
    id: 'res-003',
    userId: '',
    roomNumber: '302',
    checkIn: '2024-03-10',
    checkOut: '2024-03-12',
    status: 'cancelled',
    totalPrice: 300,
  },
]

function UserInfoCard({ user }: { user: User }) {
  return (
    <div className="rounded-xl bg-white p-6 ">
      <h2 className="mb-4 text-lg font-bold text-[#1A1A1A]">User Information</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-[#787774]">Name</p>
          <p className="font-medium text-[#1A1A1A]">{user.name}</p>
        </div>
        <div>
          <p className="text-xs text-[#787774]">Email</p>
          <p className="font-medium text-[#1A1A1A]">{user.email}</p>
        </div>
        <div>
          <p className="text-xs text-[#787774]">Phone</p>
          <p className="font-medium text-[#1A1A1A]">{user.phone}</p>
        </div>
        <div>
          <p className="text-xs text-[#787774]">Role</p>
          <span className="mt-1 inline-block rounded-full bg-[#F9F9F8] px-3 py-1 text-xs font-bold text-[#555555]">
            {user.role}
          </span>
        </div>
      </div>
    </div>
  )
}

function ReservationsTable({
  reservations,
  labels,
}: {
  reservations: Reservation[]
  labels: Record<string, string>
}) {
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

  const columns = useMemo<TableColumn<Reservation & Record<string, unknown>>[]>(() => [
    { key: 'roomNumber', label: labels.room || 'Room' },
    { key: 'checkIn', label: labels.checkIn || 'Check In' },
    { key: 'checkOut', label: labels.checkOut || 'Check Out' },
    {
      key: 'status',
      label: labels.status || 'Status',
      render: (_value, reservation) => (
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(reservation.status)}`}>
          {reservation.status}
        </span>
      ),
    },
    {
      key: 'totalPrice',
      label: labels.total || 'Total',
      render: (_value, reservation) => `$${reservation.totalPrice}`,
    },
  ], [labels])

  return (
    <div className="rounded-xl bg-white p-6 ">
      <h2 className="mb-4 text-lg font-bold text-[#1A1A1A]">Reservations</h2>
      <Table
        columns={columns}
        data={reservations as Array<Reservation & Record<string, unknown>>}
        pageSize={5}
        pageSizeOptions={[5, 10, 20]}
        sortable={false}
      />
    </div>
  )
}

export const UserDetailsPage = memo(function UserDetailsPage({
  user,
  labels,
}: UserDetailsPageProps) {
  const router = useRouter()

  // In real implementation, fetch reservations via hook
  const reservations = PLACEHOLDER_RESERVATIONS.map((r) => ({ ...r, userId: user.id }))

  // Calculate analytics
  const totalReservations = reservations.length
  const totalRevenue = reservations
    .filter((r) => r.status !== 'cancelled')
    .reduce((sum, r) => sum + r.totalPrice, 0)
  const lastBooking = reservations
    .filter((r) => r.status !== 'cancelled')
    .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime())[0]

  const analyticsCards = [
    {
      label: labels.totalBookings as string || 'Total Reservations',
      value: totalReservations.toString(),
      icon: '📅',
    },
    {
      label: labels.totalSpent as string || 'Total Spent',
      value: `$${totalRevenue.toLocaleString()}`,
      icon: '💰',
    },
    {
      label: labels.lastBooking as string || 'Last Reservation',
      value: lastBooking ? lastBooking.checkIn : '-',
      icon: '📆',
    },
  ]

  return (
    <main className="min-h-screen bg-[#F4F5F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EAEAEA] bg-white text-[#555555] transition-colors hover:bg-[#F9F9F8]"
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-[#1A1A1A]">
            {labels.detailsTitle as string || 'User Details'}
          </h1>
        </div>

        {/* Analytics Cards */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {analyticsCards.map((card, index) => (
            <AOS key={card.label} animation="fade-up" delay={Math.min(index * 100, 200)}>
              <article
                className="rounded-xl border border-[#EAEAEA] bg-white p-6  transition duration-200 hover:"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{card.label}</p>
                <p className="mt-2 text-4xl font-bold tracking-tight text-[#1A1A1A]">{card.value}</p>
              </article>
            </AOS>
          ))}
        </section>

        {/* User Info */}
        <UserInfoCard user={user} />

        {/* Reservations Table */}
        <ReservationsTable reservations={reservations} labels={labels as Record<string, string>} />
      </div>
    </main>
  )
})
