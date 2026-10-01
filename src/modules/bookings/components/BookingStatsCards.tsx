'use client'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { InfoHint } from '@/shared/components/InfoHint'
import { MoneyTotals } from '@/shared/components/MoneyTotals'
import type { Booking } from '../types'
import type { ReactNode } from 'react'

interface BookingStatsCardsProps {
  bookings: Booking[]
  loading?: boolean
}

interface StatCard {
  label: string
  hint: string
  value: ReactNode
  accent: string
  icon: string
  bg: string
}

function calculateStats(bookings: Booking[], now: Date): StatCard[] {
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const thisWeek = bookings.filter((b) => new Date(b.createdAt) >= weekAgo)

  const booked = thisWeek.filter((b) => b.status === 'booked').length
  const occupied = thisWeek.filter((b) => b.status === 'confirmed' || b.status === 'checked-in').length
  const cancelled = thisWeek.filter((b) => b.status === 'cancelled').length
  // Reservations can be in different currencies: never add them into one number.
  const revenue = <MoneyTotals value={thisWeek.map((b) => ({ amount: b.totalAmount, currency: b.currency }))} />

  return [
    {
      label: 'bookings.stats.bookedRooms',
      hint: 'bookings.stats.bookedRoomsHint',
      value: booked,
      accent: 'text-[#346538]',
      icon: '✓',
      bg: 'bg-[#EDF3EC]',
    },
    {
      label: 'bookings.stats.occupied',
      hint: 'bookings.stats.occupiedHint',
      value: occupied,
      accent: 'text-sky-600',
      icon: '○',
      bg: 'bg-[#E1F3FE]',
    },
    {
      label: 'bookings.stats.cancelled',
      hint: 'bookings.stats.cancelledHint',
      value: cancelled,
      accent: 'text-[#9F2F2D]',
      icon: '✕',
      bg: 'bg-[#FDEBEC]',
    },
    {
      label: 'bookings.stats.totalRevenue',
      hint: 'bookings.stats.totalRevenueHint',
      value: revenue,
      accent: 'text-[#1A1A1A]',
      icon: '$',
      bg: 'bg-[#F5F5F5]',
    },
  ]
}

export function BookingStatsCards({ bookings, loading }: BookingStatsCardsProps) {
  const { t } = useTranslation()
  const stats = calculateStats(bookings, new Date())

  return (
    <section aria-label={t('bookings.stats.periodLabel')} className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#787774]">
        {t('bookings.stats.periodLabel')}
        <InfoHint text={t('bookings.stats.periodHint')} />
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`flex items-center gap-3 rounded-xl border border-[#EAEAEA] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${stat.bg}`}
        >
          <div aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold ${stat.accent} ${stat.bg}`}>
            {stat.icon}
          </div>
          <div className="min-w-0">
            {loading ? (
              <span className="my-1 block h-5 w-12 animate-pulse rounded bg-black/10" aria-label={t('common.loading')} />
            ) : (
              <p className="break-words text-lg font-bold tracking-tight tabular-nums text-[#1A1A1A]">{stat.value}</p>
            )}
            <p className="flex items-center gap-1 text-xs font-medium text-[#787774]">
              <span className="truncate">{t(stat.label)}</span>
              <InfoHint text={t(stat.hint)} />
            </p>
          </div>
        </div>
      ))}
      </div>
    </section>
  )
}
