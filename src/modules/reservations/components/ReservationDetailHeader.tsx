'use client'

import type { ReservationDetail } from '@/modules/reservations/types'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { CurrencyCode } from '@/shared/utils/types'
import { MoneyAmount } from '@/shared/components/MoneyTotals'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-[#FBF3DB] text-[#956400]',
  held: 'bg-[#FDEBEC] text-[#9F2F2D]',
  confirmed: 'bg-[#E1F3FE] text-[#1F6C9F]',
  checked_in: 'bg-[#EDF3EC] text-[#346538]',
  checked_out: 'bg-[#F5F5F5] text-[#555555]',
  cancelled: 'bg-[#FDEBEC] text-[#9F2F2D]',
  no_show: 'bg-[#FDEBEC] text-[#9F2F2D]',
  expired: 'bg-[#F5F5F5] text-[#787774]',
  failed: 'bg-[#FDEBEC] text-[#9F2F2D]',
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

interface Props {
  detail: ReservationDetail
}

export function ReservationDetailHeader({ detail }: Props) {
  const { currencyCode } = useCurrency()
  const rowCurrency = (detail.currency as CurrencyCode | null | undefined) ?? currencyCode

  const fields = detail as ReservationDetail & {
    reservation_number?: string | null
    check_in_date?: string | null
    check_out_date?: string | null
    booker_name?: string | null
    balance_amount?: number | string | null
    room_count?: number | null
    adults?: number | null
    children?: number | null
  }
  const statusKey = String(detail.status).toLowerCase()
  const reservationNumber = fields.reservation_number ?? detail.id.slice(0, 8)
  const checkIn = fields.check_in_date ?? ''
  const checkOut = fields.check_out_date ?? ''
  const roomCount = detail.rooms.length
  const guestCount = detail.guests.length
  const adults = fields.adults ?? 1
  const children = fields.children ?? 0
  const companyName = detail.companyInfo?.company_name

  return (
    <div className="rounded-xl border border-[#EAEAEA] bg-white p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLES[statusKey] ?? 'bg-[#F5F5F5] text-[#555555]'}`}>
              {formatLabel(statusKey)}
            </span>
            <span className="text-[11px] font-medium text-[#787774]">
              #{reservationNumber}
            </span>
            {companyName && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-[#FBF3DB] px-2 py-0.5 text-[11px] font-semibold text-[#956400]">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                {companyName}
              </span>
            )}
          </div>

          <h1 className="mt-3 break-words text-2xl font-semibold tracking-tight text-[#1A1A1A]">
            {companyName || fields.booker_name || 'Reservation detail'}
          </h1>
          <p className="mt-1 text-sm text-[#787774]">
            <span className="whitespace-nowrap">{checkIn}</span> to <span className="whitespace-nowrap">{checkOut}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-6 rounded-lg bg-[#F9F9F8] px-4 py-2.5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#787774]">Total</p>
              <p className="text-sm font-semibold text-[#1A1A1A]"><MoneyAmount inline amount={Number(detail.total_amount ?? 0)} currency={rowCurrency} /></p>
            </div>
            <div className="h-8 w-px bg-[#EAEAEA]" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#787774]">Paid</p>
              <p className="text-sm font-semibold text-[#1A1A1A]"><MoneyAmount inline amount={Number(detail.paid_amount ?? 0)} currency={rowCurrency} /></p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-[#EAEAEA] pt-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#787774]">Rooms</p>
          <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{roomCount || fields.room_count || 0}</p>
        </div>
        <div className="h-6 w-px bg-[#EAEAEA]" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#787774]">Guests</p>
          <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{guestCount}</p>
        </div>
        <div className="h-6 w-px bg-[#EAEAEA]" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#787774]">Party</p>
          <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{adults + children}</p>
        </div>
      </div>
    </div>
  )
}
