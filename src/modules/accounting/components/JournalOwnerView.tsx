'use client'

import { useState } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import type { JournalWorkspace } from '../journal/types'
import { journalCompact, journalMoney, isNegative } from '../journal/format'
import { JOURNAL_QUICK_ACTIONS, type JournalQuickAction } from './JournalEntryForm'

type Entry = JournalWorkspace['entries'][number]

export function JournalOwnerView({ data, currency, canPost, onQuickAction, onSelectEntry, onViewEntries }: {
  data: JournalWorkspace; currency: string; canPost: boolean
  onQuickAction: (action: JournalQuickAction) => void; onSelectEntry: (entry: Entry) => void; onViewEntries: () => void
}) {
  const { t } = useTranslation()
  const label = (key: string) => t(`accounting.journal.${key}`)
  const { owner } = data
  const month = [
    { key: 'monthRevenue', value: owner.monthRevenue, hint: 'revenueHint', tone: 'text-emerald-700' },
    { key: 'monthExpenses', value: owner.monthExpenses, hint: 'expensesHint', tone: 'text-amber-700' },
    { key: 'monthProfit', value: owner.monthProfit, hint: 'profitHint', tone: isNegative(owner.monthProfit) ? 'text-red-700' : 'text-emerald-700' },
  ]
  const position = [
    { key: 'cash', value: owner.cash, hint: 'cashHint' },
    { key: 'receivable', value: owner.receivable, hint: 'receivableHint' },
    { key: 'payable', value: owner.payable, hint: 'payableHint' },
  ]
  const recent = data.entries.slice(0, 5)

  return <div className="space-y-5">
    <section aria-labelledby="journal-month-heading" className="space-y-3">
      <h3 id="journal-month-heading" className="text-sm font-medium text-stone-500">{label('thisMonth')}</h3>
      <div className="grid gap-3 sm:grid-cols-3">{month.map((card) => <div key={card.key} className="rounded-xl border border-stone-200 bg-white p-5">
        <p className="text-sm text-stone-500">{label(card.key)}</p>
        <p dir="ltr" className={`mt-2 wrap-break-word text-2xl font-semibold tabular-nums ${card.tone}`}>{journalMoney(card.value, currency)}</p>
        <p className="mt-1 text-xs text-stone-400">{label(card.hint)}</p>
      </div>)}</div>
    </section>

    <section aria-labelledby="journal-position-heading" className="space-y-3">
      <h3 id="journal-position-heading" className="text-sm font-medium text-stone-500">{label('position')}</h3>
      <div className="grid gap-3 sm:grid-cols-3">{position.map((card) => <div key={card.key} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="text-sm text-stone-500">{label(card.key)}</p>
        <p dir="ltr" className={`mt-1 wrap-break-word text-xl font-semibold tabular-nums ${isNegative(card.value) ? 'text-red-700' : 'text-stone-900'}`}>{journalMoney(card.value, currency)}</p>
        <p className="mt-1 text-xs text-stone-400">{label(card.hint)}</p>
      </div>)}</div>
    </section>

    <TrendChart data={data} currency={currency} />

    <div className={`grid gap-5 ${canPost ? 'lg:grid-cols-2' : ''}`}>
      {canPost && <section aria-labelledby="journal-quick-heading" className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <div><h3 id="journal-quick-heading" className="font-semibold">{label('quickActions')}</h3><p className="mt-1 text-xs text-stone-500">{label('quickActionsHint')}</p></div>
        <div className="grid gap-2 sm:grid-cols-2">{JOURNAL_QUICK_ACTIONS.map((action) => <button key={action.key} type="button" onClick={() => onQuickAction(action.key)} className="min-h-14 rounded-lg border border-stone-200 p-3 text-start transition-colors hover:border-stone-400 hover:bg-accent/10">
          <span className="block text-sm font-medium text-stone-800">{label(action.key)}</span>
          <span className="block text-xs text-stone-500">{label(`${action.key}Hint`)}</span>
        </button>)}</div>
      </section>}
      <section aria-labelledby="journal-recent-heading" className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-3"><h3 id="journal-recent-heading" className="font-semibold">{label('recentEntries')}</h3>{data.entries.length > 0 && <button type="button" className="min-h-10 text-sm text-stone-600 underline" onClick={onViewEntries}>{label('viewAll')}</button>}</div>
        {recent.length ? <ul className="divide-y divide-stone-100">{recent.map((entry) => <li key={entry.id}><button type="button" onClick={() => onSelectEntry(entry)} className="flex w-full items-center justify-between gap-3 py-3 text-start hover:bg-accent/10">
          <span className="min-w-0"><span className="block truncate text-sm text-stone-800">{entry.description}</span><span className="block text-xs text-stone-500">{entry.date} · {entry.entryNumber}</span></span>
          <span dir="ltr" className="shrink-0 text-sm font-medium tabular-nums">{journalMoney(entry.total, entry.currency)}</span>
        </button></li>)}</ul> : <p className="py-6 text-center text-sm text-stone-500">{label('noEntries')}</p>}
      </section>
    </div>
  </div>
}

const W = 600, H = 240, LEFT = 56, RIGHT = 8, TOP = 12, BOTTOM = 28

function TrendChart({ data, currency }: { data: JournalWorkspace; currency: string }) {
  const { t } = useTranslation()
  const label = (key: string) => t(`accounting.journal.${key}`)
  const [chart, setChart] = useState<'performance' | 'cash'>('performance')
  const [showFigures, setShowFigures] = useState(false)
  const series = data.trend.map((row) => ({ date: row.date, first: Number(row[chart === 'cash' ? 'cashIn' : 'revenue']), second: Number(row[chart === 'cash' ? 'cashOut' : 'expenses']) }))
  const firstLabel = label(chart === 'cash' ? 'cashIn' : 'monthRevenue')
  const secondLabel = label(chart === 'cash' ? 'cashOut' : 'monthExpenses')
  const hasData = series.some((row) => row.first !== 0 || row.second !== 0)
  // Reversals can make a day negative, so the scale always includes zero on both sides.
  const max = Math.max(0, ...series.flatMap((row) => [row.first, row.second]))
  const min = Math.min(0, ...series.flatMap((row) => [row.first, row.second]))
  const span = max - min || 1
  const y = (value: number) => TOP + (max - value) / span * (H - TOP - BOTTOM)
  const slot = (W - LEFT - RIGHT) / Math.max(series.length, 1)
  const bar = Math.max(1, slot / 2 - 1.5)
  const ticks = [max, (max + min) / 2, min].filter((value, index, all) => all.indexOf(value) === index)

  return <section aria-labelledby="journal-trend-heading" className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 id="journal-trend-heading" className="font-semibold">{label('trend')}</h3>
      <div className="flex gap-1 rounded-lg bg-stone-100 p-1">{(['performance', 'cash'] as const).map((mode) => <button key={mode} type="button" aria-pressed={chart === mode} className={`min-h-9 rounded-md px-3 text-sm ${chart === mode ? 'bg-accent/10 text-accent-ink shadow-sm' : 'text-stone-600'}`} onClick={() => setChart(mode)}>{label(mode === 'cash' ? 'cashMovement' : 'profitTrend')}</button>)}</div>
    </div>
    <div className="flex flex-wrap gap-4 text-xs text-stone-600">
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />{firstLabel}</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-amber-500" />{secondLabel}</span>
      <span className="text-stone-400">{currency}</span>
    </div>
    {hasData ? <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${firstLabel} / ${secondLabel} · ${currency}`} className="w-full max-h-72" style={{ direction: 'ltr' }}>
      {ticks.map((value) => <g key={value}>
        <line x1={LEFT} x2={W - RIGHT} y1={y(value)} y2={y(value)} stroke={value === 0 ? '#a8a29e' : '#e7e5e4'} strokeDasharray={value === 0 ? undefined : '4 4'} />
        <text x={LEFT - 6} y={y(value) + 4} textAnchor="end" fontSize="11" fill="#78716c">{journalCompact(value)}</text>
      </g>)}
      {series.map((row, index) => {
        const x = LEFT + index * slot + 1
        return <g key={row.date}>
          <title>{`${row.date} · ${firstLabel}: ${journalMoney(row.first.toFixed(2), currency)} · ${secondLabel}: ${journalMoney(row.second.toFixed(2), currency)}`}</title>
          <rect x={x} width={bar} y={Math.min(y(row.first), y(0))} height={Math.abs(y(row.first) - y(0))} rx="1.5" fill="#059669" />
          <rect x={x + bar + 1} width={bar} y={Math.min(y(row.second), y(0))} height={Math.abs(y(row.second) - y(0))} rx="1.5" fill="#f59e0b" />
        </g>
      })}
      {series.length > 0 && <>
        <text x={LEFT} y={H - 8} fill="#78716c" fontSize="11">{series[0].date.slice(5)}</text>
        <text x={W - RIGHT} y={H - 8} fill="#78716c" fontSize="11" textAnchor="end">{series[series.length - 1].date.slice(5)}</text>
      </>}
    </svg> : <p className="rounded-lg border border-dashed border-stone-200 py-10 text-center text-sm text-stone-500">{label('noChartData')}</p>}
    <p className="text-xs text-stone-500">{label(chart === 'cash' ? 'cashChartHint' : 'profitChartHint')}</p>
    {hasData && <button type="button" className="min-h-10 text-sm underline" aria-expanded={showFigures} onClick={() => setShowFigures(!showFigures)}>{label('viewFigures')}</button>}
    {showFigures && hasData && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-stone-500"><th className="p-2 text-start font-medium">{label('date')}</th><th className="p-2 text-end font-medium">{firstLabel}</th><th className="p-2 text-end font-medium">{secondLabel}</th></tr></thead>
      <tbody>{series.filter((row) => row.first !== 0 || row.second !== 0).map((row) => <tr key={row.date} className="border-t border-stone-100"><td className="p-2">{row.date}</td><td className="p-2 text-end tabular-nums" dir="ltr">{journalMoney(row.first.toFixed(2), currency)}</td><td className="p-2 text-end tabular-nums" dir="ltr">{journalMoney(row.second.toFixed(2), currency)}</td></tr>)}</tbody></table></div>}
  </section>
}
