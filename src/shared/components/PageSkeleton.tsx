'use client'

import { useTranslation } from '@/i18n/hooks/useTranslation'

export function PageSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="animate-pulse space-y-6" role="status" aria-label={t('common.loading')}>
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 rounded-xl bg-[#EAEAEA]" />
        <div className="flex gap-2">
          <div className="h-9 w-20 rounded-xl bg-[#EAEAEA]" />
          <div className="h-9 w-20 rounded-xl bg-[#EAEAEA]" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[#EAEAEA]" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="flex gap-4">
          <div className="h-10 flex-1 rounded-xl bg-[#EAEAEA]" />
          <div className="h-10 w-32 rounded-xl bg-[#EAEAEA]" />
        </div>
        <div className="h-72 rounded-xl bg-[#EAEAEA]" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 rounded-xl bg-[#EAEAEA]" />
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-xl bg-[#EAEAEA]" />
          <div className="h-8 w-8 rounded-xl bg-[#EAEAEA]" />
          <div className="h-8 w-8 rounded-xl bg-[#EAEAEA]" />
        </div>
      </div>
    </div>
  );
}
