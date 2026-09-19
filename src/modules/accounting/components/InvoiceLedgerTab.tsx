'use client'

import { formatDate } from '@/shared/utils/date'
import type { LedgerEntry } from '../types'
import { LEDGER_TYPE_LABELS } from '../types'

interface InvoiceLedgerTabProps {
 ledger: LedgerEntry[]
 t: (key: string) => string
 locale: string
 formatCurrency: (amount: number) => string
}

export function InvoiceLedgerTab({ ledger, t, locale, formatCurrency }: InvoiceLedgerTabProps) {
 if (ledger.length === 0) {
 return <p className="py-8 text-center text-sm text-[#787774]">{t('accounting.invoices.detail.noLedgerEntries')}</p> }

 return (
 <div className="space-y-2"> {ledger.map((entry) => (
 <div key={entry.id} className="flex items-center justify-between rounded-lg border border-[#EAEAEA] bg-[#F9F9F8]/50 p-3 text-sm"> <div> <span className="font-medium text-[#333333]">{LEDGER_TYPE_LABELS[entry.type] ?? entry.type}</span> <p className="mt-0.5 text-xs text-[#787774]">{entry.description}</p> <p className="text-xs text-[#787774]">{formatDate(entry.transactionDate, locale)}</p> </div> <div className="text-right"> {entry.incomeAmount> 0 && <p className="font-medium text-[#346538]">+{formatCurrency(entry.incomeAmount)}</p>}
 {entry.outcomeAmount> 0 && <p className="font-medium text-[#9F2F2D]">-{formatCurrency(entry.outcomeAmount)}</p>}
 </div> </div> ))}
 </div> )
}
