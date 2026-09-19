'use client'

import type { Invoice } from '../types'
import { INVOICE_ITEM_TYPE_LABELS } from '../types'

interface InvoiceItemsTabProps {
 invoice: Invoice
 t: (key: string) => string
 formatCurrency: (amount: number) => string
}

export function InvoiceItemsTab({ invoice, t, formatCurrency }: InvoiceItemsTabProps) {
 const items = invoice.items
 if (!items || items.length === 0) {
 return <p className="py-8 text-center text-sm text-[#787774]">{t('common.noData')}</p> }

 return (
 <div className="space-y-2"> {items.map((item) => (
 <div key={item.id} className="flex items-center justify-between rounded-lg border border-[#EAEAEA] bg-[#F9F9F8]/50 p-3 text-sm"> <div className="min-w-0 flex-1"> <div className="flex items-center gap-2"> <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-[#787774]"> {INVOICE_ITEM_TYPE_LABELS[item.type] ?? item.type}
 </span> <span className="truncate font-medium text-[#333333]">{item.description}</span> </div> <p className="mt-1 text-xs text-[#787774]"> {item.quantity} x {formatCurrency(item.unitPrice)}
 </p> </div> <div className="text-right"> <p className="font-semibold">{formatCurrency(item.totalPrice)}</p> {(item.discountAmount> 0 || item.taxAmount> 0) && (
 <p className="text-xs text-[#787774]"> {item.discountAmount> 0 && <span>-{formatCurrency(item.discountAmount)} </span>}
 {item.taxAmount> 0 && <span>+{formatCurrency(item.taxAmount)} </span>}
 </p> )}
 </div> </div> ))}
 </div> )
}
