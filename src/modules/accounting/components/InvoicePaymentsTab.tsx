'use client'

import { formatDateTime } from '@/shared/utils/date'
import type { Payment } from '../types'
import { PAYMENT_METHOD_LABELS } from '../types'

interface InvoicePaymentsTabProps {
 payments: Payment[]
 t: (key: string) => string
 locale: string
 formatCurrency: (amount: number) => string
}

export function InvoicePaymentsTab({ payments, t, locale, formatCurrency }: InvoicePaymentsTabProps) {
 if (payments.length === 0) {
 return <p className="py-8 text-center text-sm text-[#787774]">{t('accounting.invoices.detail.noPayments')}</p> }

 return (
 <div className="space-y-2"> {payments.map((p) => (
 <div key={p.id} className="flex items-center justify-between rounded-lg border border-[#EAEAEA] bg-[#F9F9F8]/50 p-3 text-sm"> <div> <span className="font-medium">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> {p.description && <span className="ml-2 text-[#787774]">{p.description}</span>}
 <p className="mt-0.5 text-xs text-[#787774]">{formatDateTime(p.createdAt, locale)}</p> </div> <span className={`font-medium ${Number(p.amount) < 0 ? 'text-[#9F2F2D]' : 'text-[#346538]'}`}> {formatCurrency(Number(p.amount))}
 </span> </div> ))}
 </div> )
}
