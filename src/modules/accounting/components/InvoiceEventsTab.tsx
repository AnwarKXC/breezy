'use client'

import { formatDateTime } from '@/shared/utils/date'
import type { InvoiceEvent } from '../types'
import { eventLabels } from '../hooks/useInvoiceDetail'

interface InvoiceEventsTabProps {
 events: InvoiceEvent[]
 t: (key: string) => string
 locale: string
 formatCurrency: (amount: number) => string
}

export function InvoiceEventsTab({ events, t, locale, formatCurrency }: InvoiceEventsTabProps) {
 if (events.length === 0) {
 return <p className="py-8 text-center text-sm text-[#787774]">{t('common.noData')}</p> }

 return (
 <div className="space-y-2"> {events.map((event) => (
 <div key={event.id} className="flex items-start justify-between rounded-lg border border-[#EAEAEA] bg-[#F9F9F8]/50 p-3 text-sm"> <div> <span className="font-medium text-[#333333]"> {eventLabels(event.eventType, t)}
 </span> {event.reason && <p className="mt-0.5 text-xs text-[#787774]">{event.reason}</p>}
 {event.oldStatus && event.newStatus && (
 <p className="mt-0.5 text-xs text-[#787774]"> {event.oldStatus} → {event.newStatus}
 </p> )}
 <p className="mt-0.5 text-xs text-[#787774]">{formatDateTime(event.createdAt, locale)}</p> </div> {event.amountChanged && event.amountChanged !== 0 && (
 <span className={`text-xs font-medium ${event.amountChanged < 0 ? 'text-[#9F2F2D]' : 'text-[#346538]'}`}> {event.amountChanged> 0 ? '+' : ''}{formatCurrency(event.amountChanged)}
 </span> )}
 </div> ))}
 </div> )
}
