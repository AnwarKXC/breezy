'use client'

import { useState } from 'react'

import { useAssistantT } from '../i18n'
import { fetchData, useResource } from '@/shared/data/useResource'
import { formatDateTime } from '@/shared/utils/date'

import type { ConversationDetail, ConversationSummary, UsageSummary } from '../types'
import { label } from '../utils/format'

function UsageCard({ usage }: { usage: UsageSummary }) {
  const { t } = useAssistantT()
  const percent = usage.today.limit ? Math.min(100, Math.round((usage.today.tokens / usage.today.limit) * 100)) : 0
  const maxDaily = Math.max(...usage.daily.map((d) => d.tokens), 1)
  const sqlCalls = usage.topTools.find((tool) => tool.name === 'run_readonly_sql')?.calls ?? 0
  const stats = [
    { key: 'turns30', value: usage.turns.toLocaleString() },
    { key: 'errors30', value: usage.errors.toLocaleString() },
    { key: 'avgLatency', value: `${(usage.avgLatencyMs / 1000).toFixed(1)}s` },
    { key: 'sqlQueries', value: sqlCalls.toLocaleString() },
  ]
  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{label(t, 'assistant.usage.title')}</h3>
        <span className="text-xs text-ink-muted tabular-nums" dir="ltr">
          {usage.today.tokens.toLocaleString()} / {usage.today.limit.toLocaleString()}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">{label(t, 'assistant.usage.todayTokens')}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F1F1EF]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${percent >= 90 ? 'bg-red-500' : 'bg-accent'}`} style={{ width: `${Math.max(percent, 1)}%` }} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 @lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.key} className="rounded-lg bg-surface-muted px-3 py-2">
            <dt className="truncate text-xs text-ink-muted">{label(t, `assistant.usage.${stat.key}`)}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink tabular-nums" dir="ltr">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4" aria-label={label(t, 'assistant.usage.daily')}>
        <p className="mb-1 text-xs text-ink-muted">{label(t, 'assistant.usage.daily')}</p>
        <div className="flex h-12 items-end gap-0.5" dir="ltr">
          {usage.daily.map((day) => (
            <span
              key={day.date}
              title={`${day.date}: ${day.tokens.toLocaleString()} tokens, ${day.turns} questions`}
              className={`flex-1 rounded-sm ${day.errors ? 'bg-amber-400' : 'bg-accent/70'}`}
              style={{ height: `${day.tokens ? Math.max(6, (day.tokens / maxDaily) * 100) : 2}%` }}
            />
          ))}
        </div>
      </div>
      {sqlCalls > 0 && <p className="mt-3 text-xs text-ink-muted">{label(t, 'assistant.usage.sqlHint')}</p>}
    </section>
  )
}

export function AssistantHistory({ activeId, onOpen }: { activeId: string; onOpen: (detail: ConversationDetail) => void }) {
  const { t, locale } = useAssistantT()
  const conversations = useResource('/api/ai/conversations', () => fetchData<ConversationSummary[]>('/api/ai/conversations'))
  const usage = useResource('/api/ai/usage', () => fetchData<UsageSummary>('/api/ai/usage'))
  const [opening, setOpening] = useState<string | null>(null)
  const [openError, setOpenError] = useState(false)

  const open = async (id: string) => {
    setOpening(id)
    setOpenError(false)
    try {
      onOpen(await fetchData<ConversationDetail>(`/api/ai/conversations/${id}`))
    } catch {
      setOpenError(true)
    } finally {
      setOpening(null)
    }
  }

  return (
    <div className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        {usage.data && <UsageCard usage={usage.data} />}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">{label(t, 'assistant.history.title')}</h3>
          {conversations.isLoading && <p className="text-sm text-ink-muted">{label(t, 'assistant.history.loading')}</p>}
          {(conversations.error || openError) && <p className="text-sm text-red-700">{label(t, 'assistant.errors.failed')}</p>}
          {conversations.data?.length === 0 && <p className="text-sm text-ink-muted">{label(t, 'assistant.history.empty')}</p>}
          <ul className="flex flex-col gap-2">
            {conversations.data?.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => void open(conversation.id)}
                  disabled={opening !== null}
                  aria-current={conversation.id === activeId ? 'true' : undefined}
                  className={`w-full rounded-lg border px-3 py-2.5 text-start transition-colors disabled:opacity-60 ${
                    conversation.id === activeId ? 'border-ink bg-white' : 'border-line bg-surface-muted hover:border-[#D4D4D2] hover:bg-white'
                  }`}
                >
                  <span dir="auto" className="line-clamp-2 block text-sm text-ink">
                    {conversation.title}
                  </span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    {opening === conversation.id
                      ? label(t, 'assistant.history.opening')
                      : `${formatDateTime(conversation.updatedAt, locale)} · ${label(t, 'assistant.history.turns').replace('{count}', String(conversation.turns))}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
