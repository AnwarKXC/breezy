'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInvoices } from './useInvoices'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useLocale } from '@/i18n/components/LocaleContext'
import { toast } from '@/shared/toast/toastEvents'
import { downloadInvoicePdf } from '../utils/invoicePdfExport'
import { PAYMENT_METHOD_LABELS, type Payment } from '../types'

export type DetailTab = 'overview' | 'items' | 'payments' | 'ledger' | 'events'

function eventLabels(type: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    created: t('accounting.invoiceEvents.created'),
    draft_saved: t('accounting.invoiceEvents.draft_saved'),
    updated: t('accounting.invoiceEvents.updated'),
    issued: t('accounting.invoiceEvents.issued'),
    voided: t('accounting.invoiceEvents.voided'),
    deleted: t('accounting.invoiceEvents.deleted'),
    payment_recorded: t('accounting.invoiceEvents.payment_recorded'),
    payment_refunded: t('accounting.invoiceEvents.payment_refunded'),
    payment_voided: t('accounting.invoiceEvents.payment_voided'),
    adjusted: t('accounting.invoiceEvents.adjusted'),
    pdf_downloaded: t('accounting.invoiceEvents.pdf_downloaded'),
    printed: t('accounting.invoiceEvents.printed'),
    status_changed: t('accounting.invoiceEvents.status_changed'),
  }
  return labels[type] ?? type
}

const NO_PAYMENTS: Payment[] = []

export function useInvoiceDetail(invoiceId: string, t: (key: string) => string) {
  const { formatCurrency: formatIn } = useCurrency()
  const locale = useLocale()
  const { currentInvoice, loadById, invoiceLedger, invoiceEvents, loadLedger, loadEvents, clearCurrent } = useInvoices()
  // Everything in an invoice's detail is in the invoice's own currency.
  const formatCurrency = (amount: number, code?: string | null) => formatIn(amount, code ?? currentInvoice?.currency)
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [showPayments, setShowPayments] = useState(false)
  const [showVoid, setShowVoid] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [printingPdf, setPrintingPdf] = useState(false)

  useEffect(() => {
    loadById(invoiceId)
    loadLedger(invoiceId)
    loadEvents(invoiceId)
    return () => { clearCurrent() }
  }, [invoiceId, loadById, loadLedger, loadEvents, clearCurrent])

  const handleLoadLedger = useCallback(() => {
    loadLedger(invoiceId)
    setActiveTab('ledger')
  }, [invoiceId, loadLedger])

  const handleLoadEvents = useCallback(() => {
    loadEvents(invoiceId)
    setActiveTab('events')
  }, [invoiceId, loadEvents])

  const handleIssue = useCallback(async () => {
    setIssuing(true)
    try {
      const res = await fetch(`/api/accounting/invoices/${invoiceId}/issue`, { method: 'POST' })
      if (res.ok) loadById(invoiceId)
    } catch (error) { console.error('[InvoiceDetailModal] Failed to issue invoice:', error) }
    finally { setIssuing(false) }
  }, [invoiceId, loadById])

  const handlePrintPdf = useCallback(async () => {
    if (!currentInvoice) return
    setPrintingPdf(true)
    try {
      await downloadInvoicePdf(currentInvoice, locale)
    } catch (error) {
      console.error('[InvoiceDetailModal] Failed to print PDF:', error)
      toast.error('Failed to generate PDF', { description: 'Please try again or check browser console for details.' })
    }
    finally { setPrintingPdf(false) }
  }, [currentInvoice, locale])

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'overview', label: t('accounting.invoices.detail.overview') },
    { key: 'items', label: t('accounting.invoices.detail.lineItems') },
    { key: 'payments', label: t('accounting.invoices.detail.payments') },
    { key: 'ledger', label: t('accounting.invoices.detail.ledger') },
    { key: 'events', label: t('accounting.invoices.detail.auditHistory') },
  ]

  const invoice = currentInvoice
  const payments = invoice?.payments ?? NO_PAYMENTS

  const timeline = useMemo(() => {
    if (!invoice) return []
    const paymentItems = payments.map((payment) => ({
      amount: Number(payment.amount),
      date: payment.createdAt ?? '',
      description: payment.description ?? PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
      id: `payment-${payment.id}`,
      kind: Number(payment.amount) < 0 ? t('accounting.invoiceEvents.payment_refunded') : t('accounting.invoiceEvents.payment_recorded'),
    }))
    const eventItems = (invoice.events ?? invoiceEvents)
      .filter((event) => event.eventType !== 'payment_refunded')
      .map((event) => ({
        amount: event.amountChanged ?? 0,
        date: event.createdAt ?? '',
        description: event.reason ?? (event.oldStatus && event.newStatus ? `${event.oldStatus} -> ${event.newStatus}` : ''),
        id: `event-${event.id}`,
        kind: eventLabels(event.eventType, t),
      }))

    return [...paymentItems, ...eventItems]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 8)
  }, [invoiceEvents, payments, t, invoice])

  return {
    formatCurrency,
    locale,
    invoice,
    invoiceLedger,
    invoiceEvents,
    payments,
    activeTab,
    showPayments,
    showVoid,
    showRefund,
    issuing,
    printingPdf,
    tabs,
    timeline,
    setActiveTab,
    setShowPayments,
    setShowVoid,
    setShowRefund,
    handleLoadLedger,
    handleLoadEvents,
    handleIssue,
    handlePrintPdf,
    setIssuing,
    setPrintingPdf,
    loadById,
  }
}

export { eventLabels }
