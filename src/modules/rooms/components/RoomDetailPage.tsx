'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useResource } from '@/shared/data/useResource'
import { SkeletonCard } from '@/shared/components/SkeletonCard'
import { Table } from '@/shared/table'
import { ToolbarExportGroup } from '@/shared/components/toolbar/ToolbarExportGroup'
import { toast } from '@/shared/toast/toastEvents'
import { buildAndDownloadPdf } from '@/shared/utils/pdfMake'
import { roomService } from '@/services/roomService'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import type { Money } from '@/shared/currency/money'
import { MoneyTotals } from '@/shared/components/MoneyTotals'
import { MoneyAmount } from '@/shared/components/MoneyTotals'

type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'dirty'

interface StatusHistoryEntry {
  id: string
  created_at: string
  old_status: RoomStatus | null
  new_status: RoomStatus
  notes: string | null
  changed_by: string | null
  reservation: {
    id: string | null
    reservation_number: string | null
    status: string
    check_in_date: string | null
    check_out_date: string | null
    guests: { full_name: string }[] | null
  } | null
}

interface UpcomingReservation {
  id: string
  check_in_date: string
  check_out_date: string
  status: string
  adults: number
  children: number
  reservation: {
    id: string
    reservation_number: string | null
    status: string
    check_in_date: string
    check_out_date: string
    guests: { full_name: string }[] | null
  } | null
}

interface RoomDetailData {
  room: {
    id: string
    number: string
    floor: number
    status: RoomStatus
    capacity: number
    price: number
    amenities: string[]
    roomType: { name: string; slug: string } | null
  }
  statusHistory: StatusHistoryEntry[]
  upcomingReservations: UpcomingReservation[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
  revenue: {
    /** One total per currency (stays keep their reservation's currency). */
    total: Money
    bookingCount: number
  }
}

const STATUS_PASTEL: Record<RoomStatus, { bg: string; text: string }> = {
  available: { bg: '#EDF3EC', text: '#346538' },
  occupied: { bg: '#E1F3FE', text: '#1F6C9F' },
  maintenance: { bg: '#FDEBEC', text: '#9F2F2D' },
  cleaning: { bg: '#FBF3DB', text: '#956400' },
  dirty: { bg: '#FDEBEC', text: '#9F2F2D' },
}

const ACTION_COLORS: Record<string, { bg: string; hover: string }> = {
  emerald: { bg: '#111111', hover: '#333333' },
  red: { bg: '#111111', hover: '#333333' },
  orange: { bg: '#111111', hover: '#333333' },
  amber: { bg: '#111111', hover: '#333333' },
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

function PastelBadge({ status }: { status: RoomStatus }) {
  const { t } = useTranslation()
  const s = STATUS_PASTEL[status] ?? STATUS_PASTEL.available
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em]"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {t('bookings.roomStatus.' + status)}
    </span>
  )
}

const EMPTY_HISTORY: StatusHistoryEntry[] = []

async function fetchRoomDetail(id: string): Promise<RoomDetailData> {
  const res = await fetch(`/api/rooms/${id}/history?limit=100&offset=0`)
  const json = await res.json().catch(() => null)
  if (json?.ok && json.data) return json.data as RoomDetailData
  throw new Error(json?.error?.message ?? '')
}

export function RoomDetailPage() {
  const { t } = useTranslation()
  const { id, locale } = useParams<{ id: string; locale: string }>()
  const router = useRouter()
  const roomDetail = useResource(`/api/rooms/${id}/history`, () => fetchRoomDetail(id))
  const data = roomDetail.data ?? null
  const history = data?.statusHistory ?? EMPTY_HISTORY
  const loading = roomDetail.isLoading
  const error = roomDetail.error ? roomDetail.error.message || t('rooms.detail.failedToLoad') : null
  const fetchDetail = roomDetail.refresh
  const [changingStatus, setChangingStatus] = useState(false)

  const handleStatusChange = useCallback(async (nextStatus: RoomStatus) => {
    if (!data || changingStatus) return
    setChangingStatus(true)
    try {
      await roomService.setStatus(data.room.id, nextStatus)

      toast.success(`Room ${data.room.number} → ${t('bookings.roomStatus.' + nextStatus)}`)
      await fetchDetail()
    } catch {
      toast.error(t('rooms.detail.failedUpdateStatus'))
    }
    setChangingStatus(false)
  }, [data, changingStatus, fetchDetail, t])

  const historyColumns = useMemo(() => [
    { key: 'created_at' as const, label: t('rooms.detail.date'), render: (v: unknown) => formatDate(v as string) },
    {
      key: 'check_in_date' as const,
      label: t('rooms.detail.from'),
      render: (_v: unknown, row: Record<string, unknown>) => {
        const r = (row as unknown as StatusHistoryEntry).reservation
        if (!r?.check_in_date) return <span className="text-[#787774]">—</span>
        return <span className="text-sm text-[#333333]">{r.check_in_date}</span>
      },
    },
    {
      key: 'check_out_date' as const,
      label: t('rooms.detail.to'),
      render: (_v: unknown, row: Record<string, unknown>) => {
        const r = (row as unknown as StatusHistoryEntry).reservation
        if (!r?.check_out_date) return <span className="text-[#787774]">—</span>
        return <span className="text-sm text-[#333333]">{r.check_out_date}</span>
      },
    },
    { key: 'notes' as const, label: t('rooms.detail.notes'), render: (v: unknown) => (v as string) ?? '—' },
    {
      key: 'guest_name' as const,
      label: t('rooms.detail.guestName'),
      render: (_v: unknown, row: Record<string, unknown>) => {
        const r = (row as unknown as StatusHistoryEntry).reservation
        const guestName = r?.guests?.[0]?.full_name
        return guestName ?? '—'
      },
    },
    {
      key: 'reservation_number' as const,
      label: t('rooms.detail.reservation'),
      render: (_v: unknown, row: Record<string, unknown>) => {
        const r = (row as unknown as StatusHistoryEntry).reservation
        const number = r?.reservation_number
        if (!number) return <span className="text-[#787774]">—</span>
        return (
          <button
            type="button"
            data-ignore-row-click
            onClick={() => router.push(`/${locale}/reservations/${r!.id}`)}
            className="text-sm font-medium text-[#346538] underline-offset-2 hover:underline"
          >
            {number}
          </button>
        )
      },
    },
  ], [locale, router, t])

  const handleExportCsv = useCallback(() => {
    const headerRow = [t('rooms.detail.date'), t('rooms.detail.from'), t('rooms.detail.to'), t('rooms.detail.notes'), t('rooms.detail.guestName'), t('rooms.detail.reservation')].join(',')
    const dataRows = history.map((h) =>
      [h.created_at, h.reservation?.check_in_date ?? '', h.reservation?.check_out_date ?? '', h.notes ?? '', h.reservation?.guests?.[0]?.full_name ?? '', h.reservation?.reservation_number ?? '']
        .map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const blob = new Blob([`\uFEFF${headerRow}\n${dataRows}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `room-${data?.room.number}-history-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [t, history, data?.room.number])

  const handleExportPdf = useCallback(() => {
    const headers = [t('rooms.detail.date'), t('rooms.detail.from'), t('rooms.detail.to'), t('rooms.detail.notes'), t('rooms.detail.guestName'), t('rooms.detail.reservation')]
    const rows = history.map((h) => [
      formatDate(h.created_at),
      h.reservation?.check_in_date ?? '—',
      h.reservation?.check_out_date ?? '—',
      h.notes ?? '—',
      h.reservation?.guests?.[0]?.full_name ?? '—',
      h.reservation?.reservation_number ?? '—',
    ])
    const roomNumber = data?.room.number ?? '—'
    void buildAndDownloadPdf({
      title: `Room ${roomNumber} - ${t('rooms.detail.statusHistory')}`,
      headers,
      rows,
      locale: locale as 'ar' | 'en',
      fileName: `room-${roomNumber}-history-${new Date().toISOString().slice(0, 10)}.pdf`,
    })
  }, [t, history, data?.room.number, locale])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <SkeletonCard />
          <div className="grid gap-4 sm:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] p-6">
        <div className="mx-auto max-w-lg rounded-xl border border-[#EAEAEA] bg-white p-8">
          <p className="text-sm font-semibold" style={{ color: '#9F2F2D' }}>{error ?? t('rooms.detail.roomNotFound')}</p>
          <p className="mt-1 text-sm" style={{ color: '#9F2F2D' }}>
            {t('rooms.detail.couldNotLoad')}
          </p>
          <button
            onClick={() => router.push(`/${locale}/reservations`)}
            className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-all duration-200 hover:bg-accent-hover active:scale-[0.98]"
          >
            {t('rooms.detail.backToRooms')}
          </button>
        </div>
      </div>
    )
  }

  const { room } = data

  const actionLabels: Record<string, string> = {
    cleaning: t('rooms.detail.setCleaning'),
    maintenance: t('rooms.detail.setMaintenance'),
    dirty: t('rooms.detail.markDirty'),
    available: t('rooms.detail.markAvailable'),
  }
  const actions = [
    room.status === 'available' && { label: actionLabels.cleaning, nextStatus: 'cleaning' as const },
    room.status === 'available' && { label: actionLabels.maintenance, nextStatus: 'maintenance' as const },
    room.status === 'occupied' && { label: actionLabels.dirty, nextStatus: 'dirty' as const },
    room.status === 'maintenance' && { label: actionLabels.available, nextStatus: 'available' as const },
    room.status === 'cleaning' && { label: actionLabels.available, nextStatus: 'available' as const },
    room.status === 'dirty' && { label: actionLabels.available, nextStatus: 'available' as const },
  ].filter(Boolean) as { label: string; nextStatus: RoomStatus }[]

  const amenitiesList = Array.isArray(room.amenities) ? room.amenities : []

  return (
    <div className="min-h-screen bg-[#F7F6F3] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-10">

        <button
          onClick={() => router.push(`/${locale}/reservations`)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white px-3 py-1.5 text-xs font-medium text-[#787774] transition-all duration-200 hover:bg-[#F7F6F3] active:scale-[0.98]"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {t('rooms.detail.backToRooms')}
        </button>

        <section className="rounded-xl border border-[#EAEAEA] bg-white p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[#111111]" style={{ fontFamily: "'Lyon Text', 'Newsreader', 'Instrument Serif', serif", letterSpacing: '-0.03em' }}>
                Room {room.number}
              </h1>
              <PastelBadge status={room.status} />
            </div>
            <span className="ml-auto text-xs text-[#787774]">
              {room.roomType?.name ?? '—'} &middot; Floor {room.floor}
            </span>
          </div>

          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-[#EAEAEA] bg-[#EAEAEA] sm:grid-cols-4">
            {[
              { label: t('rooms.detail.nightlyRate'), value: <MoneyAmount inline amount={Number(room.price)} /> },
              { label: t('rooms.detail.capacity'), value: `${room.capacity} ${room.capacity === 1 ? t('rooms.detail.guest') : t('rooms.detail.guests')}` },
              { label: t('rooms.detail.floor'), value: `${room.floor}` },
              { label: t('rooms.detail.status'), value: t('bookings.roomStatus.' + room.status) },
            ].map((cell) => (
              <div key={cell.label} className="bg-white px-5 py-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#787774]">{cell.label}</p>
                <p className="mt-1 text-sm font-semibold text-[#111111]">{cell.value}</p>
              </div>
            ))}
          </div>

          {amenitiesList.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[#787774]">{t('rooms.detail.amenities')}</p>
              <div className="flex flex-wrap gap-1.5">
                {amenitiesList.map((a) => (
                  <span key={a} className="rounded-full border border-[#EAEAEA] bg-[#F7F6F3] px-3 py-1 text-xs text-[#787774]">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t('rooms.detail.totalRevenue'), value: <MoneyTotals value={data.revenue?.total} />, tint: 'bg-[#EDF3EC]' },
            { label: t('rooms.detail.nightlyRate'), value: <MoneyAmount amount={Number(room.price)} />, tint: 'bg-indigo-50' },
            { label: t('rooms.detail.roomType'), value: room.roomType?.name ?? '—', tint: 'bg-[#FBF3DB]' },
            { label: t('rooms.detail.upcoming'), value: data.upcomingReservations.length, tint: 'bg-violet-50' },
          ].map((card) => (
            <div key={card.label} className={`rounded-xl p-7 ${card.tint}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#787774]">{card.label}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-[#1A1A1A]">{card.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-[#EAEAEA] bg-white p-6">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-[#787774]">{t('rooms.detail.roomActions')}</p>
          <div className="flex flex-wrap gap-2.5">
            {actions.length > 0 ? actions.map((action) => {
              const color = ACTION_COLORS.emerald
              return (
                <button
                  key={action.nextStatus}
                  type="button"
                  disabled={changingStatus}
                  onClick={() => handleStatusChange(action.nextStatus)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-40"
                  style={{ backgroundColor: color.bg }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = color.hover }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = color.bg }}
                >
                  {action.label}
                </button>
              )
            }) : (
              <p className="text-sm text-[#787774]">{t('rooms.detail.noActions')}</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#EAEAEA] bg-white p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#787774]">{t('rooms.detail.history')}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#111111]" style={{ fontFamily: "'Lyon Text', 'Newsreader', 'Instrument Serif', serif", letterSpacing: '-0.03em' }}>
                {t('rooms.detail.bookingHistory')}
              </h2>
            </div>
            <ToolbarExportGroup
              onExportCsv={handleExportCsv}
              onExportPdf={handleExportPdf}
              csvLabel={t('rooms.detail.csv')}
              pdfLabel={t('rooms.detail.pdf')}
            />
          </div>
          <Table
            data={history as unknown as Record<string, unknown>[]}
            columns={historyColumns}
            sortable={false}
            paginate
            pageSize={10}
            pageSizeOptions={[10, 20, 50, 100]}
            emptyMessage={t('rooms.detail.noBookingHistory')}
            onRowClick={(row) => {
              const r = (row as unknown as StatusHistoryEntry).reservation
              if (r?.id) router.push(`/${locale}/reservations/${r.id}`)
            }}
          />
        </section>

        {/* Upcoming reservations section hidden */}

      </div>
    </div>
  )
}
