'use client'

import { InvoicesSection } from './InvoicesSection'
import type { Invoice } from '../types/invoiceTypes'

interface ContactInvoiceListProps {
 invoices: Invoice[]
  labels: Record<string, string>; onExportCsv: () => void
 onExportPdf: () => void
}

export function ContactInvoiceList({
 invoices,
 labels,
 onExportCsv,
 onExportPdf,
}: ContactInvoiceListProps) {
 return (
 <InvoicesSection
 invoices={invoices}
 labels={labels}
 onExportCsv={onExportCsv}
 onExportPdf={onExportPdf}
 /> )
}
