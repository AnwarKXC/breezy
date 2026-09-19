'use client'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import type { Booking } from '../types'

interface BookingStatsCardsProps {
  bookings: Booking[]
  formatCurrency: (amount: number) => string
  loading?: boolean
}

interface StatCard {
  label: string
  value: string | number
  accent: string
  icon: string
  bg: string
}

function calculateStats(bookings: Booking[], formatCurrency: (n: number) => string, now: Date): StatCard[] {
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const thisWeek = bookings.filter((b) => new Date(b.createdAt) >= weekAgo)

  const booked = thisWeek.filter((b) => b.status === 'booked').length
  const occupied = thisWeek.filter((b) => b.status === 'confirmed' || b.status === 'checked-in').length
  const cancelled = thisWeek.filter((b) => b.status === 'cancelled').length
  const revenue = thisWeek.reduce((sum, b) => sum + b.totalAmount, 0)

  return [
    {
      label: 'bookings.stats.bookedRooms',
      value: booked,
      accent: 'text-[#346538]',
      icon: '✓',
      bg: 'bg-[#EDF3EC]',
    },
    {
      label: 'bookings.stats.occupied',
      value: occupied,
      accent: 'text-sky-600',
      icon: '○',
      bg: 'bg-[#E1F3FE]',
    },
    {
      label: 'bookings.stats.cancelled',
      value: cancelled,
      accent: 'text-[#9F2F2D]',
      icon: '✕',
      bg: 'bg-[#FDEBEC]',
    },
    {
      label: 'bookings.stats.totalRevenue',
      value: formatCurrency(revenue),
      accent: 'text-[#1A1A1A]',
      icon: '$',
      bg: 'bg-[#F5F5F5]',
    },
  ]
}

export function BookingStatsCards({ bookings, formatCurrency, loading }: BookingStatsCardsProps) {
  const { t } = useTranslation()
  const stats = calculateStats(bookings, formatCurrency, new Date())

  return (
    <div className="flex flex-col gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`flex items-center gap-3 rounded-xl border border-[#EAEAEA] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${stat.bg}`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold ${stat.accent} ${stat.bg}`}>
            {stat.icon}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold tracking-tight text-[#1A1A1A]">
              {loading ? '...' : stat.value}
            </p>
            <p className="truncate text-xs font-medium text-[#787774]">
              {t(stat.label)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
