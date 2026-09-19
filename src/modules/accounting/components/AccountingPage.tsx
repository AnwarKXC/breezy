'use client'

import { useEffect, useState, useMemo } from 'react'
import { AccountingDashboardTab } from './AccountingDashboardTab'
import { InvoicesTab } from './InvoicesTab'
import { PaymentsTab } from './PaymentsTab'
import { ExpenseManager } from './ExpenseManager'
import { LedgerTab } from './LedgerTab'
import { ReportsTab } from './ReportsTab'
import { AccountingPageSkeleton } from './AccountingPageSkeleton'
import ar from '@/i18n/locales/ar.json'
import en from '@/i18n/locales/en.json'

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

const allTranslations: Record<string, Record<string, unknown>> = { ar, en }

function createT(locale: string) {
  return (key: string): string => {
    const keys = key.split('.')
    let result: unknown = allTranslations[locale]
    for (const k of keys) {
      if (result && typeof result === 'object') {
        result = (result as Record<string, unknown>)[k]
      } else {
        return key
      }
    }
    return typeof result === 'string' ? result : key
  }
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

export function AccountingPage({ locale }: AccountingPageProps) {
  const t = useMemo(() => createT(locale), [locale])
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [invoiceFilters, setInvoiceFilters] = useState<InvoiceFilters>({
    searchQuery: '',
    statusFilter: 'all',
    dateRangeStart: '',
    dateRangeEnd: '',
  })

  useEffect(() => {
    const savedTab = window.localStorage.getItem(TAB_STORAGE_KEY)
    if (isTab(savedTab)) setActiveTab(savedTab)
  }, [])

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    window.localStorage.setItem(TAB_STORAGE_KEY, tab)
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

      {tabContent}
    </div>
  )
}

export { AccountingPageSkeleton }
