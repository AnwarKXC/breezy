import { USER_ROLES } from '@/config/rbac'
import { AnalyticsCard } from '@/shared/components/AnalyticsCard'
import { Skeleton } from '@/shared/components/Skeleton'
import type { UserRole } from '../types'

interface UsersAnalyticsProps {
  loading?: boolean
  metrics: Record<UserRole | 'total', number>
  labels: Record<UserRole | 'total', string>
}

const USER_ACCENTS: Record<UserRole | 'total', 'indigo' | 'rose' | 'cyan' | 'emerald'> = {
  total: 'indigo',
  admin: 'rose',
  front_desk: 'cyan',
  accountant: 'emerald',
}

export function UsersAnalytics({ loading = false, metrics, labels }: UsersAnalyticsProps) {
  const cards: readonly (UserRole | 'total')[] = ['total', ...USER_ROLES]

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((key) => (
        loading ? (
          <div key={key} className="rounded-xl border border-[#EAEAEA] bg-white p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-14" />
          </div>
        ) : (
          <AnalyticsCard
            key={key}
            label={labels[key]}
            value={metrics[key]}
            accent={USER_ACCENTS[key]}
          />
        )
      ))}
    </section>
  )
}

