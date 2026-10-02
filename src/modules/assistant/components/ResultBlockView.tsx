'use client'

import { useState } from 'react'


import { useAnswerT } from '../i18n'
import type { ResultBlock } from '../types'
import { downloadCsv, fieldLabel, formatCell, formatPeriod, label } from '../utils/format'

const TABLE_PREVIEW_ROWS = 10

function BlockHeader({ block, action }: { block: ResultBlock; action?: React.ReactNode }) {
  const { t, locale } = useAnswerT()
  const period = formatPeriod(block.period, t, locale)
  const subtitle = 'subtitle' in block ? block.subtitle : undefined
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{label(t, `assistant.blocks.${block.title}`)}</h3>
        {subtitle && (
          <p dir="auto" className="mt-0.5 text-xs text-ink-muted">
            {subtitle}
          </p>
        )}
        {period && <p className="mt-0.5 text-xs text-ink-muted">{period}</p>}
      </div>
      {action}
    </div>
  )
}

function KpiBlock({ block }: { block: Extract<ResultBlock, { type: 'kpi' }> }) {
  const { t, locale } = useAnswerT()
  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <BlockHeader block={block} />
      <dl className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @4xl:grid-cols-4">
        {block.items.map((item, index) => (
          <div key={`${item.key}-${item.currency ?? ''}-${index}`} className="min-w-0 rounded-lg bg-surface-muted px-3 py-2.5">
            <dt className="truncate text-xs text-ink-muted">
              {fieldLabel(t, item.key)}
              {item.currency && item.format !== 'money' ? ` · ${item.currency}` : ''}
            </dt>
            <dd className="mt-1 truncate text-base font-semibold text-ink" dir="ltr">
              {formatCell(item.value, item.format, { t, locale, currency: item.currency })}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function TableBlock({ block }: { block: Extract<ResultBlock, { type: 'table' }> }) {
  const { t, locale } = useAnswerT()
  const [expanded, setExpanded] = useState(false)
  const rows = expanded ? block.rows : block.rows.slice(0, TABLE_PREVIEW_ROWS)
  const cell = (row: Record<string, unknown>, column: (typeof block.columns)[number]) =>
    formatCell(row[column.key] as never, column.format, { t, locale, currency: column.currencyKey ? (row[column.currencyKey] as string) : null })

  const exportCsv = () =>
    downloadCsv(
      `${block.title}.csv`,
      block.columns.map((column) => fieldLabel(t, column.key)),
      block.rows.map((row) => block.columns.map((column) => cell(row, column))),
    )

  if (!block.rows.length) {
    return (
      <section className="rounded-xl border border-line bg-white p-4">
        <BlockHeader block={block} />
        <p className="text-sm text-ink-muted">{label(t, 'assistant.noRows')}</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <BlockHeader
        block={block}
        action={
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-md border border-line bg-surface-muted px-2.5 py-1 text-xs font-medium text-[#333333] transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {label(t, 'assistant.exportCsv')}
          </button>
        }
      />
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-muted">
              {block.columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-2 py-2 text-start font-medium">
                  {fieldLabel(t, column.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-[#F1F1EF] last:border-0">
                {block.columns.map((column) => {
                  const numeric = column.format !== 'text' && column.format !== 'enum' && column.format !== 'date'
                  return (
                    <td key={column.key} className={`whitespace-nowrap px-2 py-2 text-ink ${numeric ? 'tabular-nums' : ''}`} dir={numeric ? 'ltr' : 'auto'}>
                      {cell(row, column)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(block.rows.length > TABLE_PREVIEW_ROWS || block.totalRows > block.rows.length) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
          <span>
            {label(t, 'assistant.showingRows')
              .replace('{shown}', String(rows.length))
              .replace('{total}', String(Math.max(block.totalRows, block.rows.length)))}
          </span>
          {block.rows.length > TABLE_PREVIEW_ROWS && (
            <button type="button" onClick={() => setExpanded((value) => !value)} className="font-medium text-ink hover:underline">
              {label(t, expanded ? 'assistant.showLess' : 'assistant.showAll')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function BarsBlock({ block }: { block: Extract<ResultBlock, { type: 'bars' }> }) {
  const { t, locale } = useAnswerT()
  const values = block.rows.map((row) => (typeof row[block.valueKey] === 'number' ? (row[block.valueKey] as number) : 0))
  const max = Math.max(...values, 0)
  if (block.rows.length < 2 || max <= 0) return null
  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <BlockHeader block={block} />
      <ul className="space-y-1.5">
        {block.rows.map((row, index) => (
          <li key={index} className="grid grid-cols-[minmax(4.5rem,7rem)_1fr_auto] @xl:grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-2 text-xs">
            <span className="truncate text-ink-muted" dir="auto">
              {formatCell(row[block.labelKey], block.labelFormat, { t, locale })}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-[#F1F1EF]">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(1.5, (values[index] / max) * 100)}%` }} />
            </span>
            <span className="tabular-nums text-ink" dir="ltr">
              {formatCell(values[index], block.format, { t, locale, currency: block.currency })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ResultBlockView({ block }: { block: ResultBlock }) {
  if (block.type === 'kpi') return <KpiBlock block={block} />
  if (block.type === 'table') return <TableBlock block={block} />
  return <BarsBlock block={block} />
}
