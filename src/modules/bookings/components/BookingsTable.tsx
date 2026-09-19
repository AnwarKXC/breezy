'use client'

import { countryName } from '@/shared/static/countries'
import { useMemo } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Table, TableActionsMenu, type TableColumn } from '@/shared/table'
import { BOOKING_STATUS_STYLES } from '../utils/roomStatusStyles'
import type { Booking, BookingStatus } from '../types'
import type { Guest } from '@/modules/guests/types'

export interface BookingsTableRow extends Record<string, unknown> {
  booking: Booking
  guest?: Guest
  priceLabel: string
  totalPriceLabel: string | null
  nights: number
}

interface BookingsTableProps {
  rows: BookingsTableRow[]
  loading?: boolean
  onCheckIn?: (booking: Booking) => void
  onCheckOut?: (booking: Booking) => void
  onCancel?: (booking: Booking) => void
  onEdit?: (booking: Booking) => void
  onView?: (booking: Booking) => void
  onInvoice?: (booking: Booking) => void
  onExtend?: (booking: Booking) => void
  onChangeRoom?: (booking: Booking) => void
  onDelete?: (booking: Booking) => void
  onNavigate?: (booking: Booking) => void
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusActions(
  status: BookingStatus,
  callbacks: Pick<BookingsTableProps, 'onCheckIn' | 'onCheckOut' | 'onCancel' | 'onEdit' | 'onView' | 'onInvoice' | 'onExtend' | 'onChangeRoom' | 'onDelete'>,
  booking: Booking,
  t: (key: string) => string,
) {
  const items: { label: string; onSelect: () => void; destructive?: boolean }[] = []
  switch (status) {
    case 'booked':
      if (callbacks.onCheckIn) items.push({ label: t('bookings.actions.checkIn'), onSelect: () => callbacks.onCheckIn!(booking) })
      if (callbacks.onCancel) items.push({ label: t('bookings.actions.cancel'), onSelect: () => callbacks.onCancel!(booking), destructive: true })
      if (callbacks.onEdit) items.push({ label: t('bookings.actions.edit'), onSelect: () => callbacks.onEdit!(booking) })
      if (callbacks.onDelete) items.push({ label: t('bookings.actions.delete'), onSelect: () => callbacks.onDelete!(booking), destructive: true })
      break
    case 'confirmed':
      if (callbacks.onCheckIn) items.push({ label: t('bookings.actions.checkIn'), onSelect: () => callbacks.onCheckIn!(booking) })
      if (callbacks.onCancel) items.push({ label: t('bookings.actions.cancel'), onSelect: () => callbacks.onCancel!(booking), destructive: true })
      if (callbacks.onEdit) items.push({ label: t('bookings.actions.edit'), onSelect: () => callbacks.onEdit!(booking) })
      break
    case 'checked-in':
      if (callbacks.onCheckOut) items.push({ label: t('bookings.actions.checkOut'), onSelect: () => callbacks.onCheckOut!(booking) })
      // Extend and Change Room are managed per-room from the reservation detail page
      break
    case 'checked-out':
      if (callbacks.onView) items.push({ label: t('bookings.actions.view'), onSelect: () => callbacks.onView!(booking) })
      if (callbacks.onInvoice) items.push({ label: t('bookings.actions.invoice'), onSelect: () => callbacks.onInvoice!(booking) })
      break
    case 'cancelled':
      if (callbacks.onView) items.push({ label: t('bookings.actions.view'), onSelect: () => callbacks.onView!(booking) })
      break
  }
  return items
}

export function BookingsTable({
  rows,
  loading,
  ...callbacks
}: BookingsTableProps) {
  const { t, locale } = useTranslation()

  const columns = useMemo<TableColumn<BookingsTableRow & Record<string, unknown>>[]>(
    () => [
      {
        key: 'guestName',
        label: t('bookings.columns.guestName'),
        render: (_v, row) => (
          <span className="font-medium text-[#1A1A1A]">{row.booking.guestName}</span>
        ),
      },
      {
        key: 'roomNumber',
        label: t('bookings.columns.roomNumber'),
        render: (_v, row) => (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F5F5F5] px-2 py-0.5 text-xs font-semibold text-[#333333]">
            {row.booking.roomNumber}
            {row.booking.roomCount && row.booking.roomCount > 1 ? (
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#787774]">
                {row.booking.roomCount} rooms
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: 'roomPrice',
        label: t('bookings.columns.roomPrice'),
        render: (_v, row) => (
          <div className="leading-tight">
            <span className="text-sm font-medium text-[#1A1A1A]">{row.priceLabel}</span>
            {row.totalPriceLabel && (
              <span className="block text-[11px] text-[#787774]">{row.totalPriceLabel}</span>
            )}
          </div>
        ),
      },
      {
        key: 'totalGuest',
        label: t('bookings.columns.totalGuest'),
        render: () => <span className="text-sm text-[#555555]">1</span>,
      },
      {
        key: 'checkIn',
        label: t('bookings.columns.checkIn'),
        render: (_v, row) => (
          <span className="text-sm text-[#333333]">{formatDate(new Date(row.booking.checkIn))}</span>
        ),
      },
      {
        key: 'checkOut',
        label: t('bookings.columns.checkOut'),
        render: (_v, row) => (
          <span className="text-sm text-[#333333]">{formatDate(new Date(row.booking.checkOut))}</span>
        ),
      },
      {
        key: 'contactNumber',
        label: t('bookings.columns.contactNumber'),
        render: (_v, row) => (
          <span className="text-sm text-[#555555]">{row.guest?.phone ?? '-'}</span>
        ),
      },
      {
        key: 'country',
        label: t('bookings.columns.country'),
        render: (_v, row) => (
          <span className="text-sm text-[#555555]">{row.guest?.country ? countryName(row.guest.country, locale) : '-'}</span>
        ),
      },
      {
        key: 'idNumber',
        label: t('bookings.columns.idNumber'),
        render: (_v, row) => (
          <span className="text-sm text-[#555555]">{row.guest?.passportNumber ?? '-'}</span>
        ),
      },
      {
        key: 'status',
        label: t('bookings.columns.status'),
        sortable: true,
        render: (_v, row) => {
          const style = BOOKING_STATUS_STYLES[row.booking.status] ?? BOOKING_STATUS_STYLES.booked
          return (
            <span className={`inline-block whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-medium ${style.badge}`}>
              {t(style.labelKey)}
            </span>
          )
        },
      },
      {
        key: 'actions' as keyof BookingsTableRow,
        label: t('bookings.columns.actions'),
        render: (_v, row) => {
          const actions = statusActions(row.booking.status, callbacks, row.booking, t)
          return <TableActionsMenu actions={actions} ariaLabel={`Actions for ${row.booking.guestName}`} />
        },
      },
    ],
    [t, locale, callbacks],
  )

  return (
    <Table
      data={rows}
      columns={columns}
      loading={loading}
      // Paged server-side (BookingListPanel footer); rows are one page.
      paginate={false}
      sortable={false}
      emptyMessage={t('bookings.noBookings')}
      onRowClick={callbacks.onNavigate ? (row) => callbacks.onNavigate!((row as BookingsTableRow).booking) : undefined}
    />
  )
}
