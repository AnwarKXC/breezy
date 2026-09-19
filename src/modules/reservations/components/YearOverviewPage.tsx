'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { DayDetailPopover, type DayPopoverLabels } from './DayDetailPopover'
import { MonthCalendarCard } from './MonthCalendarCard'
import { SheetView } from './SheetView'
import { buildDayMap, indexByRoomAndDate, type DayBooking } from '../utils/dayMap'
import { monthStats } from '../utils/occupancy'
import { buildYearExcelBuffer } from '../utils/excelExport'
import { downloadYearViewPdf } from '../utils/yearViewPdfExport'
import { toast } from '@/shared/toast/toastEvents'
import type { YearOverviewPayload } from '../types'

export function YearOverviewPage() {
  const { t, locale } = useTranslation()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<YearOverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [pinnedDate, setPinnedDate] = useState<string | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [view, setView] = useState<'wall' | 'sheet'>('sheet')
  const [sheetMonth, setSheetMonth] = useState(() => new Date().getMonth())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/reservations/year-overview?year=${year}`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Request failed')
        setError(false)
        setData(json.data as YearOverviewPayload)
        setPinnedDate(null)
        setHoverDate(null)
        setPopoverPos(null)
        setSheetMonth(json.data.year === currentYear ? new Date().getMonth() : 0)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [year, reloadKey, currentYear])

  // Expensive derived work: expands every stay into per-date booking lists.
  const dayMap = useMemo<Map<string, DayBooking[]>>(
    () => (data ? buildDayMap(data.stays, data.year) : new Map()),
    [data],
  )

  const roomNumberById = useMemo(
    () => new Map((data?.rooms ?? []).map((room) => [room.id, room.number])),
    [data],
  )
  const bookingIndex = useMemo(() => indexByRoomAndDate(dayMap), [dayMap])
  const totalRooms = data?.rooms.length ?? 0

  const todayIso = new Date().toISOString().slice(0, 10)
  const showLoading = loading || !data || data.year !== year
  const activeDate = pinnedDate ?? hoverDate
  const displayedBookings = activeDate ? dayMap.get(activeDate) : undefined
  const popoverVisible = Boolean(displayedBookings?.length) && !showLoading && !error

  function openPopover(rect: DOMRect) {
    const POPOVER_WIDTH = 320
    const POPOVER_HEIGHT_ESTIMATE = 220
    let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2
    left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_WIDTH - 8))
    let top = rect.bottom + 6
    if (top + POPOVER_HEIGHT_ESTIMATE > window.innerHeight - 8) {
      top = Math.max(8, rect.top - POPOVER_HEIGHT_ESTIMATE - 6)
    }
    setPopoverPos({ top, left })
  }

  function handleDayEnter(iso: string, rect: DOMRect) {
    setHoverDate(iso)
    openPopover(rect)
  }

  function handleDayLeave() {
    setHoverDate(null)
  }

  function handleDayClick(iso: string, rect: DOMRect) {
    if (pinnedDate === iso) {
      setPinnedDate(null)
      return
    }
    setPinnedDate(iso)
    openPopover(rect)
  }

  useEffect(() => {
    if (!pinnedDate) return
    const close = () => {
      setPinnedDate(null)
      setHoverDate(null)
      setPopoverPos(null)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [pinnedDate])

  const legend = [
    { color: 'bg-blue-500', label: t('bookings.yearView.legendConfirmed') },
    { color: 'bg-emerald-500', label: t('bookings.yearView.legendInHouse') },
    { color: 'bg-gray-400', label: t('bookings.yearView.legendCheckedOut') },
    { color: 'bg-amber-500', label: t('bookings.yearView.legendOther') },
  ]

  const popoverLabels: DayPopoverLabels = {
    confirmed: t('bookings.yearView.legendConfirmed'),
    checkedIn: t('bookings.yearView.legendInHouse'),
    checkedOut: t('bookings.yearView.legendCheckedOut'),
    other: t('bookings.yearView.legendOther'),
    ofRoomsOccupied: t('bookings.yearView.ofRoomsOccupied'),
  }

  const monthTabLabels = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(data?.year ?? year, i, 1))),
  )

  async function handleExportExcel() {
    if (!data) return
    const buffer = await buildYearExcelBuffer(data, locale)
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `reservations-${data.year}.xlsx`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function handleExportPdf() {
    if (!data) return
    try {
      await downloadYearViewPdf(data, locale)
    } catch {
      toast.error('Failed to generate PDF')
    }
  }

  return (
    <main className="w-full" data-year-view-root>
      <div className="py-6 sm:px-6 lg:px-8">
        <header className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">{t('bookings.yearView.title')}</h1>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous year"
                  onClick={() => setYear((y) => y - 1)}
                  className="h-9 w-9 rounded-lg border border-[#EAEAEA] bg-white text-sm font-medium text-[#555555] transition-colors hover:bg-[#F9F9F8]"
                >
                  ‹
                </button>
                <span className="min-w-[64px] text-center text-lg font-semibold tabular-nums text-[#1A1A1A]">{year}</span>
                <button
                  type="button"
                  aria-label="Next year"
                  onClick={() => setYear((y) => y + 1)}
                  className="h-9 w-9 rounded-lg border border-[#EAEAEA] bg-white text-sm font-medium text-[#555555] transition-colors hover:bg-[#F9F9F8]"
                >
                  ›
                </button>
              </div>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-[#787774]">
              <Link href={`/${locale}/reservations`} className="underline-offset-2 hover:underline">
                {t('common.back')}
              </Link>
              {legend.map((item) => (
                <span key={item.color} className="inline-flex items-center gap-1.5">
                  <span className={`inline-block h-3 w-3 rounded-sm ${item.color}`} />
                  {item.label}
                </span>
              ))}
            </p>
            <div className="mt-3 inline-flex rounded-lg border border-[#EAEAEA] bg-white p-0.5">
              {(['sheet', 'wall'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setView(v)
                    setPinnedDate(null)
                    setHoverDate(null)
                    setPopoverPos(null)
                  }}
                  className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                    view === v ? 'bg-[#1A1A1A] text-white' : 'text-[#555555] hover:bg-[#F9F9F8]'
                  }`}
                >
                  {t(v === 'wall' ? 'bookings.yearView.viewWall' : 'bookings.yearView.viewSheet')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={showLoading || error}
              className="inline-flex h-9 items-center rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm font-medium text-[#555555] transition-colors hover:bg-[#F9F9F8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('bookings.yearView.exportCsv')}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={showLoading || error}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1A1A1A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('bookings.yearView.exportPdf')}
            </button>
          </div>
        </header>

        {!showLoading && !error && view === 'sheet' && (
          <div className="no-print mb-4 flex flex-wrap gap-1.5">
            {monthTabLabels.map((label, i) => (
              <button
                key={label + i}
                type="button"
                onClick={() => setSheetMonth(i)}
                className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors ${
                  sheetMonth === i ? 'bg-[#1A1A1A] text-white' : 'border border-[#EAEAEA] bg-white text-[#555555] hover:bg-[#F9F9F8]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {showLoading && !error && (
          <div className="rounded-xl border border-[#EAEAEA] bg-white p-10 text-center text-sm text-[#787774]">
            {t('common.loading')}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{t('bookings.yearView.loadError')}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-3 h-9 rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm font-medium text-[#555555] transition-colors hover:bg-[#F9F9F8]"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {!showLoading && !error && data && view === 'wall' && (
          <div className="relative">
            {data.stays.length === 0 && (
              <div className="mb-5 rounded-xl border border-[#EAEAEA] bg-white p-6 text-center text-sm text-[#787774]">
                {t('bookings.yearView.empty').replace('{year}', String(year))}
              </div>
            )}
            <div data-wall className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }, (_, monthIndex) => (
                <div key={monthIndex} data-month-wrapper>
                  <MonthCalendarCard
                    year={data.year}
                    monthIndex={monthIndex}
                    locale={locale}
                    bookingsByDate={dayMap}
                    todayIso={todayIso}
                    activeDate={activeDate}
                    stats={monthStats(data.stays, data.year, monthIndex)}
                    onDayEnter={handleDayEnter}
                    onDayLeave={handleDayLeave}
                    onDayClick={handleDayClick}
                  />
                </div>
              ))}
            </div>
            {popoverVisible && popoverPos && activeDate && displayedBookings && (
              <div
                className="pointer-events-none fixed z-50 print:hidden"
                style={{ top: popoverPos.top, left: popoverPos.left }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="pointer-events-auto">
                  <DayDetailPopover
                    dateIso={activeDate}
                    bookings={displayedBookings}
                    roomNumberById={roomNumberById}
                    totalRooms={totalRooms}
                    locale={locale}
                    labels={popoverLabels}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {!showLoading && !error && data && view === 'sheet' && (
          <SheetView
            year={data.year}
            monthIndex={sheetMonth}
            locale={locale}
            rooms={data.rooms}
            roomTypes={data.roomTypes}
            bookingIndex={bookingIndex}
            todayIso={todayIso}
          />
        )}
      </div>
    </main>
  )
}
