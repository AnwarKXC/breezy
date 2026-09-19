import { AnalyticsCard } from '@/shared/components/AnalyticsCard'
import { Skeleton } from '@/shared/components/Skeleton'
import type { LogsAnalytics as LogsAnalyticsData } from '../types'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { getModuleLabel } from '../utils/logDisplay'

interface LogsAnalyticsProps {
  analytics: LogsAnalyticsData | null
  loading?: boolean
  labels: {
    mostActiveUser: string
    mostUsedModule: string
    totalToday: string
  }
}

interface LogCard {
  label: string
  value: string
  accent: 'indigo' | 'amber' | 'violet'
}

export function LogsAnalytics({ analytics, loading = false, labels }: LogsAnalyticsProps) {
  const { t } = useTranslation()
  const cards: LogCard[] = [
    { label: labels.totalToday, value: String(analytics?.totalActionsToday ?? 0), accent: 'indigo' },
    { label: labels.mostActiveUser, value: analytics?.mostActiveUser || '-', accent: 'amber' },
    {
      label: labels.mostUsedModule,
      value: analytics?.mostUsedModule ? getModuleLabel(analytics.mostUsedModule, t) : '-',
      accent: 'violet',
    },
  ]

  return (
    <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        loading ? (
          <div key={card.label} className="min-w-0 rounded-xl border border-[#EAEAEA] bg-white p-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-8 w-32 max-w-full" />
          </div>
        ) : (
          <AnalyticsCard
            key={card.label}
            label={card.label}
            value={card.value}
            accent={card.accent}
          />
        )
      ))}
    </section>
  )
}
