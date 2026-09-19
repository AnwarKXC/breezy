import { memo } from 'react'
import { AnalyticsCard } from '@/shared/components/AnalyticsCard'
import type { ContactsMetrics } from '../types'

interface ContactsAnalyticsProps {
  loading?: boolean
  metrics: ContactsMetrics
  labels: Record<string, string>
}

type MetricKey = keyof ContactsMetrics

const METRIC_KEYS: MetricKey[] = ['total', 'company', 'individual']

const METRIC_ACCENTS: Record<MetricKey, 'indigo' | 'emerald' | 'amber'> = {
  total: 'indigo',
  company: 'emerald',
  individual: 'amber',
}

export const ContactsAnalytics = memo(function ContactsAnalytics({ loading = false, metrics, labels }: ContactsAnalyticsProps) {
  if (loading) {
    return (
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METRIC_KEYS.map((key) => (
          <div key={key} className="animate-pulse rounded-xl border border-[#EAEAEA] bg-white p-6">
            <div className="h-3 w-24 rounded bg-[#F5F5F5]" />
            <div className="mt-3 h-9 w-14 rounded bg-[#F5F5F5]" />
          </div>
        ))}
      </section>
    )
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {METRIC_KEYS.map((key) => (
        <AnalyticsCard
          key={key}
          label={labels[key]}
          value={metrics[key]}
          accent={METRIC_ACCENTS[key]}
        />
      ))}
    </section>
  )
})
