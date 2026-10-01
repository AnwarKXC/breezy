'use client'

import { useState, useCallback } from 'react'
import { Card } from '@/shared/components/Card'
import { ToolbarExportGroup } from '@/shared/components/toolbar'
import type { Invoice } from '../types/invoiceTypes'
import { InvoiceModal } from './InvoiceModal'
import { useLocale } from '@/i18n/components/LocaleContext'
import { formatDate } from '@/shared/utils/date'
import { MoneyAmount } from '@/shared/components/MoneyTotals'

interface InvoicesSectionProps {
  invoices: Invoice[]
  labels: Record<string, string>
  onExportCsv?: () => void
  onExportPdf?: () => void
}

function statusColor(status: string): string {
  switch (status) {
    case 'paid': return 'bg-green-50 text-green-700'
    case 'pending': return 'bg-[#FBF3DB] text-[#956400]'
    case 'overdue': return 'bg-[#FDEBEC] text-[#9F2F2D]'
    case 'cancelled': return 'bg-[#F9F9F8] text-[#787774]'
    default: return 'bg-[#F9F9F8] text-[#333333]'
  }
}

export function InvoicesSection({ invoices, labels, onExportCsv, onExportPdf }: InvoicesSectionProps) {
  const locale = useLocale()
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [printingId, setPrintingId] = useState<string | null>(null)

  const handleDownloadPdf = useCallback(async (invoice: Invoice) => {
    setPrintingId(invoice.id)
    try {
      const res = await fetch(`/api/accounting/invoices/${invoice.id}`)
      if (!res.ok) {
        console.error('[InvoicesSection] fetch invoice FAILED', res.status)
        const { toast } = await import('@/shared/toast/toastEvents')
        toast.error('Failed to load invoice')
        return
      }
      const json = await res.json()
      const full = json.data ?? json
      const { downloadInvoicePdf } = await import('@/modules/accounting/utils/invoicePdfExport')
      await downloadInvoicePdf(full, locale)
    } catch (err) {
      console.error('[InvoicesSection] handleDownloadPdf FAILED', err)
    }
    finally { setPrintingId(null) }
  }, [locale])

  if (!invoices.length) {
    return (
      <Card padding="lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1A1A1A]">{labels.invoicesTitle}</h3>
          {onExportCsv && onExportPdf ? (
            <ToolbarExportGroup
              onExportCsv={onExportCsv}
              onExportPdf={onExportPdf}
              csvLabel={labels.exportCsv}
              pdfLabel={labels.exportPdf}
            />
          ) : null}
        </div>
        <p className="text-sm text-[#787774]">{labels.noInvoices}</p>
      </Card>
    )
  }

  return (
    <>
      <Card padding="lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1A1A1A]">{labels.invoicesTitle}</h3>
          {onExportCsv && onExportPdf ? (
            <ToolbarExportGroup
              onExportCsv={onExportCsv}
              onExportPdf={onExportPdf}
              csvLabel={labels.exportCsv}
              pdfLabel={labels.exportPdf}
            />
          ) : null}
        </div>
        <div>
          <div className="hidden gap-x-4 border-b border-[#EAEAEA] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#787774] sm:grid sm:grid-cols-[1.4fr_1fr_1fr_auto]">
            <span>{labels.invoiceNumber}</span>
            <span>{labels.amount}</span>
            <span>{labels.issueDate}</span>
            <span>{labels.status}</span>
          </div>
          <div className="divide-y divide-[#EAEAEA]">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                onClick={() => setSelectedInvoice(invoice)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedInvoice(invoice) } }}
                className="grid w-full cursor-pointer grid-cols-2 items-center gap-x-4 gap-y-1.5 py-3 text-start transition-colors hover:bg-[#F9F9F8] sm:grid-cols-[1.4fr_1fr_1fr_auto]"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDownloadPdf(invoice) }}
                    disabled={printingId === invoice.id}
                    className="cursor-pointer text-sm font-semibold text-[#346538] underline underline-offset-2 transition-colors hover:text-[#1A1A1A] disabled:cursor-wait disabled:opacity-50"
                  >
                    {printingId === invoice.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        #{invoice.invoiceNumber}
                      </span>
                    ) : `#${invoice.invoiceNumber}`}
                  </button>
                </div>
                <span className="whitespace-nowrap text-sm font-medium text-[#1A1A1A]">
                  <MoneyAmount inline amount={Number(invoice.amount)} currency={invoice.currency} />
                </span>
                <span className="whitespace-nowrap text-xs text-[#787774]">{formatDate(invoice.issueDate, locale)}</span>
                <span className="justify-self-end sm:justify-self-start">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${statusColor(invoice.status)}`}>
                    {labels[invoice.status] ?? invoice.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {selectedInvoice ? (
        <InvoiceModal
          invoice={selectedInvoice}
          labels={labels}
          onClose={() => setSelectedInvoice(null)}
        />
      ) : null}
    </>
  )
}
