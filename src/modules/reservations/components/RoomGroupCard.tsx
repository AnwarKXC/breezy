'use client'

import { useState, type ComponentProps } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { CurrencyCode } from '@/shared/utils/types'
import type { ReservationRoom, ReservationGuest, OccupancyCode } from '@/modules/reservations/types'
import { RoomGuestCard } from './RoomGuestCard'

type CardProps = Omit<ComponentProps<typeof RoomGuestCard>, 'room' | 'guests' | 'roomCapacity' | 'extendedDate' | 'shortenedDate'>

interface Props extends CardProps {
  rooms: ReservationRoom[]
  guestsFor: (room: ReservationRoom) => ReservationGuest[]
  capacityFor: (room: ReservationRoom) => number | undefined
}

type RoomExtras = { room_number?: string | null; occupancy_code?: OccupancyCode | null; currency?: string; price_source?: string }

const OCC_CAPACITY: Record<string, number> = { S: 1, D: 2, T: 3 }
const OCC_LABEL: Record<string, string> = { S: 'Single', D: 'Double', T: 'Triple' }

/** Rooms that share type, occupancy, dates, rate and status collapse into one card. */
export function groupKey(room: ReservationRoom) {
  const r = room as ReservationRoom & RoomExtras
  return [r.room_type_id, r.occupancy_code, r.check_in_date, r.check_out_date, r.rate_per_night, r.currency, r.price_source, r.status].join('|')
}

export function RoomGroupCard({ rooms, guestsFor, capacityFor, ...cardProps }: Props) {
  const { t } = useTranslation()
  const { formatCurrency, currencyCode } = useCurrency()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const first = rooms[0] as ReservationRoom & RoomExtras
  const occ = first.occupancy_code ?? null
  const selected = rooms.find((r) => r.id === selectedId)
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="rounded-lg border border-[#EAEAEA] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-[#1A1A1A]">
            {t('reservations.roomCountPlural').replace('{n}', String(rooms.length))}
          </span>
          {occ && (
            <span className="rounded bg-[#F0F0F0] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#787774]">
              {OCC_LABEL[occ]}
            </span>
          )}
          {first.price_source === 'manual_override' && (
            <span className="rounded bg-[#FBF3DB] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#956400]">
              {t('reservations.manualPriceBadge')}
            </span>
          )}
          <span className="text-xs text-[#787774]">
            {fmtDate(first.check_in_date)} → {fmtDate(first.check_out_date)}
          </span>
        </div>
        <span className="text-sm font-medium text-[#333333]">
          {formatCurrency(first.rate_per_night ?? 0, (first.currency as CurrencyCode | undefined) ?? currencyCode)}
          {t('bookings.perNight')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {rooms.map((room) => {
          const r = room as ReservationRoom & RoomExtras
          const count = guestsFor(room).length
          const cap = (r.occupancy_code && OCC_CAPACITY[r.occupancy_code]) || capacityFor(room) || 0
          const active = room.id === selectedId
          return (
            <button
              key={room.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(active ? null : room.id)}
              className={`group relative flex min-h-11 flex-col items-start rounded-lg border px-3 py-2 text-left transition-all duration-200 ${
                active
                  ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white shadow-md'
                  : 'border-[#EAEAEA] bg-[#F9F9F8] text-[#1A1A1A] hover:-translate-y-0.5 hover:border-[#D4D4D4] hover:bg-white hover:shadow-sm'
              }`}
            >
              <span className="text-sm font-semibold">{r.room_number ?? room.room_id?.slice(0, 8)}</span>
              {cap > 0 && (
                <span className="mt-1 flex items-center gap-1" aria-label={`${count}/${cap}`}>
                  {Array.from({ length: cap }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${
                        i < count ? (active ? 'bg-white' : 'bg-[#1A1A1A]') : active ? 'bg-white/30' : 'bg-[#D4D4D4]'
                      }`}
                    />
                  ))}
                  <span className={`ml-1 text-[10px] ${active ? 'text-white/70' : 'text-[#787774]'}`}>{count}/{cap}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${selected ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          {selected ? (
            <RoomGuestCard
              key={selected.id}
              {...cardProps}
              room={selected}
              guests={guestsFor(selected)}
              roomCapacity={capacityFor(selected)}
            />
          ) : null}
        </div>
      </div>
      {!selected && (
        <p className="mt-2 text-xs text-[#9B9A97]">{t('reservations.selectRoomToManage')}</p>
      )}
    </div>
  )
}
