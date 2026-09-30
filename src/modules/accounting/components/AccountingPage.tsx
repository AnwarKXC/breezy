'use client'

import { useState, useMemo, useSyncExternalStore } from 'react'
import { AccountingDashboardTab } from './AccountingDashboardTab'
import { InvoicesTab } from './InvoicesTab'
import { PaymentsTab } from './PaymentsTab'
import { ExpenseManager } from './ExpenseManager'
import { LedgerTab } from './LedgerTab'
import { ReportsTab } from './ReportsTab'
import { ViewInCurrencyToggle } from '@/shared/components/ViewInCurrencyToggle'
import { AccountingPageSkeleton } from './AccountingPageSkeleton'
import { useTranslation } from '@/i18n/hooks/useTranslation'

type Tab = 'overview' | 'invoices' | 'payments' | 'expenses' | 'ledger' | 'reports'

interface InvoiceFilters {
  searchQuery: string
  statusFilter: string
  dateRangeStart: string
  dateRangeEnd: string
}

interface AccountingPageProps {
  locale: string
}

const tabs: { key: Tab; labelKey: string }[] = [
  { key: 'overview', labelKey: 'accounting.tabs.overview' },
  { key: 'invoices', labelKey: 'accounting.tabs.invoices' },
  { key: 'payments', labelKey: 'accounting.tabs.payments' },
  { key: 'expenses', labelKey: 'accounting.tabs.expenses' },
  { key: 'ledger', labelKey: 'accounting.tabs.ledger' },
  { key: 'reports', labelKey: 'accounting.tabs.reports' },
]

const TAB_STORAGE_KEY = 'hotel-system.accounting.activeTab'
const tabKeys = new Set<Tab>(tabs.map((tab) => tab.key))

function isTab(value: string | null): value is Tab {
  return Boolean(value && tabKeys.has(value as Tab))
}

function readStoredTab(): Tab | null {
  try {
    const saved = window.localStorage.getItem(TAB_STORAGE_KEY)
    return isTab(saved) ? saved : null
  } catch {
    return null
  }
}

const subscribeToNothing = () => () => {}

export function AccountingPage({ locale }: AccountingPageProps) {
  const { t } = useTranslation()
  // The user's click wins; until then show the last tab they used (server snapshot: none).
  const [selectedTab, setActiveTab] = useState<Tab | null>(null)
  const storedTab = useSyncExternalStore(subscribeToNothing, readStoredTab, () => null)
  const activeTab = selectedTab ?? storedTab ?? 'overview'
  const [invoiceFilters, setInvoiceFilters] = useState<InvoiceFilters>({
    searchQuery: '',
    statusFilter: 'all',
    dateRangeStart: '',
    dateRangeEnd: '',
  })

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, tab)
    } catch {}
  }

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return <AccountingDashboardTab t={t} />
      case 'invoices':
        return <InvoicesTab t={t} locale={locale} invoiceFilters={invoiceFilters} onInvoiceFiltersChange={setInvoiceFilters} />
      case 'payments':
        return <PaymentsTab t={t} />
      case 'expenses':
        return <ExpenseManager t={t} />
      case 'ledger':
        return <LedgerTab t={t} />
      case 'reports':
        return <ReportsTab t={t} />
    }
  }, [activeTab, t, locale, invoiceFilters])

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex gap-1 bg-[#F5F5F5] rounded-lg p-1 w-full overflow-x-auto">
        {tabs.map(({ key, labelKey }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === key
                ? 'bg-white text-[#1A1A1A] '
                : 'text-[#787774] hover:text-[#333333]'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Totals are per currency; this converts them on demand with live rates (expenses are already in the system currency). */}
      {activeTab !== 'expenses' && <ViewInCurrencyToggle className="justify-end" />}

      {tabContent}
    </div>
  )
}

export { AccountingPageSkeleton }
