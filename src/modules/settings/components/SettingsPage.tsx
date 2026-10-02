'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { RoomManagement } from '@/modules/rooms/components/RoomManagement'
import { CurrencyTab } from './CurrencyTab'
import { PricingTab } from './PricingTab'
import { EmailTab } from './email/EmailTab'
import { ThemeTab } from './ThemeTab'
import { OrganizationTab } from './OrganizationTab'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

const RoomsIcon = () => (
  <Icon>
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <rect x="9" y="13" width="6" height="8" rx="1" />
  </Icon>
)

const TaxIcon = () => (
  <Icon>
    <path d="m19 5-14 14" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </Icon>
)

const CurrencyIcon = () => (
  <Icon>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" />
  </Icon>
)

const OrganizationIcon = () => (
  <Icon>
    <path d="M3 21h18" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
    <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
  </Icon>
)

const ThemeIcon = () => (
  <Icon>
    <path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 3.5-4 3.5h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22Z" />
    <circle cx="7.5" cy="10.5" r="1" />
    <circle cx="12" cy="7" r="1" />
    <circle cx="16.5" cy="10.5" r="1" />
  </Icon>
)

/** Points "back" or "forward" in reading direction (mirrored in RTL). */
function Chevron({ direction, isRTL }: { direction: 'back' | 'forward'; isRTL: boolean }) {
  const pointsLeft = (direction === 'back') !== isRTL
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={pointsLeft ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  )
}

const EmailIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Icon>
)

const SECTIONS = [
  { id: 'organization', icon: OrganizationIcon, titleKey: 'settings.tabs.organization', descriptionKey: 'settings.manageOrganization' },
  { id: 'rooms', icon: RoomsIcon, titleKey: 'settings.tabs.rooms', descriptionKey: 'settings.manageRooms' },
  { id: 'pricing', icon: TaxIcon, titleKey: 'settings.tabs.pricing', descriptionKey: 'settings.managePricing' },
  { id: 'currency', icon: CurrencyIcon, titleKey: 'settings.tabs.currency', descriptionKey: 'settings.manageCurrency' },
  { id: 'theme', icon: ThemeIcon, titleKey: 'settings.tabs.theme', descriptionKey: 'settings.manageTheme' },
  { id: 'email', icon: EmailIcon, titleKey: 'settings.tabs.email', descriptionKey: 'settings.manageEmail' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-1 text-sm font-medium text-ink-muted">{description}</p>
    </header>
  )
}

export interface SettingsPageProps {
  permissions?: { canDeleteRooms: boolean; canWriteSettings: boolean }
  theme: { primaryColor: string }
}

export function SettingsPage({ permissions, theme }: SettingsPageProps) {
  const { t, isRTL } = useTranslation()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const hrefFor = (tab: SectionId | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab) params.set('tab', tab)
    else params.delete('tab')
    const query = params.toString()
    return `${pathname}${query ? `?${query}` : ''}`
  }

  const active = SECTIONS.find((section) => section.id === searchParams.get('tab'))

  if (!active) {
    return (
      <div>
        <PageHeading title={t('settings.title')} description={t('settings.subtitle')} />
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map(({ id, icon: SectionIcon, titleKey, descriptionKey }) => (
            <li key={id}>
              <Link
                href={hrefFor(id)}
                scroll={false}
                className="group flex h-full items-start gap-4 rounded-xl border border-line bg-white p-5 transition-colors hover:border-accent/30 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-ink transition-colors group-hover:bg-accent/20">
                  <SectionIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{t(titleKey)}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-muted">{t(descriptionKey)}</span>
                </span>
                <span className="mt-1 text-ink-muted transition-colors group-hover:text-ink">
                  <Chevron direction="forward" isRTL={isRTL} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div>
      <Link
        href={hrefFor(null)}
        scroll={false}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <Chevron direction="back" isRTL={isRTL} />
        {t('settings.title')}
      </Link>
      <PageHeading title={t(active.titleKey)} description={t(active.descriptionKey)} />
      {active.id === 'rooms' && <RoomManagement canDeleteRooms={permissions?.canDeleteRooms ?? false} />}
      {active.id === 'pricing' && <PricingTab />}
      {active.id === 'currency' && <CurrencyTab />}
      {active.id === 'email' && <EmailTab canEdit={permissions?.canWriteSettings ?? false} />}
      {active.id === 'organization' && <OrganizationTab canEdit={permissions?.canWriteSettings ?? false} />}
      {active.id === 'theme' && (
        <ThemeTab initialPrimaryColor={theme.primaryColor} canEdit={permissions?.canWriteSettings ?? false} />
      )}
    </div>
  )
}
