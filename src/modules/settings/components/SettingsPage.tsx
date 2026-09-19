'use client'

import { useCallback } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Card } from '@/shared/components/Card'
import { RoomManagement } from '@/modules/rooms/components/RoomManagement'
import { CurrencyTab } from './CurrencyTab'
import { PricingTab } from './PricingTab'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

function RoomsIcon() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <rect x="9" y="13" width="6" height="8" rx="1" />
    </svg>
  )
}

function PricingIcon() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20" />
      <path d="M8 6h8" />
      <path d="M8 10h6" />
      <path d="M8 14h8" />
      <path d="M8 18h6" />
    </svg>
  )
}

function CurrencyIcon() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 8h5a2.5 2.5 0 0 1 0 5H8" />
      <path d="M10 13v4" />
      <path d="M10 7v1" />
    </svg>
  )
}

type SettingsView = 'landing' | 'rooms' | 'currency' | 'pricing'

export function SettingsPage({ permissions }: { permissions?: { canDeleteRooms: boolean } }) {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const tab = searchParams.get('tab')
  const view: SettingsView = tab === 'rooms' ? 'rooms' : tab === 'currency' ? 'currency' : tab === 'pricing' ? 'pricing' : 'landing'

  const navigateTo = useCallback((tab: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab) {
      params.set('tab', tab)
    } else {
      params.delete('tab')
    }
    const query = params.toString()
    router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })
  }, [router, pathname, searchParams])

  if (view === 'landing') {
    return (
      <div className="flex items-start justify-start gap-4 flex-wrap">
        <Card
          className="cursor-pointer group w-56 text-center"
          padding="md"
          onClick={() => navigateTo('rooms')}
        >
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="text-[#787774] transition-colors group-hover:text-[#333333]">
              <RoomsIcon />
            </div>
            <h2 className="text-sm font-semibold text-[#1A1A1A]">
              {t('settings.tabs.rooms')}
            </h2>
            <p className="text-xs text-[#787774]">
              {t('settings.manageRooms')}
            </p>
          </div>
        </Card>

        <Card
          className="cursor-pointer group w-56 text-center"
          padding="md"
          onClick={() => navigateTo('pricing')}
        >
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="text-[#787774] transition-colors group-hover:text-[#333333]">
              <PricingIcon />
            </div>
            <h2 className="text-sm font-semibold text-[#1A1A1A]">
              {t('settings.tabs.pricing')}
            </h2>
            <p className="text-xs text-[#787774]">
              {t('settings.managePricing')}
            </p>
          </div>
        </Card>

        <Card
          className="cursor-pointer group w-56 text-center"
          padding="md"
          onClick={() => navigateTo('currency')}
        >
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="text-[#787774] transition-colors group-hover:text-[#333333]">
              <CurrencyIcon />
            </div>
            <h2 className="text-sm font-semibold text-[#1A1A1A]">
              {t('settings.tabs.currency')}
            </h2>
            <p className="text-xs text-[#787774]">
              {t('settings.manageCurrency')}
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigateTo(null)}
        className="inline-flex items-center gap-1.5 text-sm text-[#787774] hover:text-[#1A1A1A] transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back
      </button>
      {view === 'rooms' && <RoomManagement canDeleteRooms={permissions?.canDeleteRooms ?? false} />}
      {view === 'pricing' && <PricingTab />}
      {view === 'currency' && <CurrencyTab />}
    </div>
  )
}
