'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useInvoices } from '../hooks/useInvoices'
import { Table, TableActionsMenu } from '@/shared/table'
import type { TableColumn } from '@/shared/table/types'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { CurrencyCode } from '@/shared/utils/types'
import { ToolbarSearch, ToolbarExportGroup, ToolbarViewToggle } from '@/shared/components/toolbar'
import { FloatingSelect } from '@/shared/components/FloatingField'
import { InvoiceSummaryCards } from './InvoiceSummaryCards'
import { InvoiceComposerModal } from './InvoiceComposerModal'
import { InvoiceDetailModal } from './InvoiceDetailModal'
import { InvoicePaymentsModal } from './InvoicePaymentsModal'
import { VoidConfirmDialog } from './VoidConfirmDialog'
import { DiscountInvoiceDialog } from './DiscountInvoiceDialog'
import { RefundConfirmDialog } from './RefundConfirmDialog'
import type { Invoice, WizardMode } from '../types'
import { INVOICE_STATUS_LABELS, PAYMENT_TYPE_LABELS } from '../types'
import { exportInvoicesCsv } from '../utils/invoiceCsvExport'
import { exportInvoicesListPdf } from '../utils/invoiceListPdfExport'
import { downloadInvoicePdf } from '../utils/invoicePdfExport'
import { DeleteInvoiceDialog } from './DeleteInvoiceDialog'
import { InvoiceGridCard } from './InvoiceGridCard'
import { Modal } from '@/shared/components/Modal'
import { useCan } from '@/shared/rbac/useCan'
import { ACTIONS } from '@/config/rbac'
import { formatDate } from '@/shared/utils/date'

interface InvoiceFilters {
  searchQuery: string
  statusFilter: string
  dateRangeStart: string
  dateRangeEnd: string
}

interface Props {
  t: (key: string) => string
  locale: string
  invoiceFilters: InvoiceFilters
  onInvoiceFiltersChange: (filters: InvoiceFilters) => void
}

function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (status) {
    case 'paid': return 'success'
    case 'partially_paid': return 'warning'
    case 'overdue': return 'error'
    case 'issued': return 'info'
    case 'draft': return 'default'
    case 'void': return 'default'
    case 'refunded': return 'default'
    default: return 'default'
  }
}

type InvoiceTableRow = Invoice & Record<string, unknown>

export function InvoicesTab({ t, locale, invoiceFilters, onInvoiceFiltersChange }: Props) {
  const { formatCurrency } = useCurrency()

  // Pre-initialize pdfmake so first PDF download isn't slow
  useEffect(() => {
    import('@/shared/utils/pdfMake').then((m) => m.getPdfMake().catch(() => {})).catch(() => {})
  }, [])

  const { searchQuery, statusFilter, dateRangeStart, dateRangeEnd } = invoiceFilters
  const setSearchQuery = (v: string) => onInvoiceFiltersChange({ ...invoiceFilters, searchQuery: v })
  const setStatusFilter = (v: string) => onInvoiceFiltersChange({ ...invoiceFilters, statusFilter: v })
  const setDateRangeStart = (v: string) => onInvoiceFiltersChange({ ...invoiceFilters, dateRangeStart: v })
  const setDateRangeEnd = (v: string) => onInvoiceFiltersChange({ ...invoiceFilters, dateRangeEnd: v })
  const [wizardMode, setWizardMode] = useState<WizardMode | null>(null)
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null)
  const canDeleteInvoices = useCan(ACTIONS.INVOICES_DELETE)
  const canAdjustInvoices = useCan(ACTIONS.INVOICES_ADJUST)
  const [deletePermissionModalOpen, setDeletePermissionModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)
  const [voidingInvoice, setVoidingInvoice] = useState<Invoice | null>(null)
  const [refundingInvoice, setRefundingInvoice] = useState<Invoice | null>(null)
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null)
  const [discountingInvoice, setDiscountingInvoice] = useState<Invoice | null>(null)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'row' | 'grid'>('row')

  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    if (statusFilter && statusFilter !== 'all') f.status = statusFilter
    if (dateRangeStart) f.fromDate = dateRangeStart
    if (dateRangeEnd) f.toDate = dateRangeEnd
    return f
  }, [statusFilter, dateRangeStart, dateRangeEnd])

  const { invoices, loading, getNextNumber, loadById, refresh } = useInvoices(filters)

  const filteredInvoices = useMemo(() => {
    if (!searchQuery) return invoices
    const q = searchQuery.toLowerCase()
    return invoices.filter((inv) => {
      const statusLabel = (INVOICE_STATUS_LABELS as Record<string, string>)[inv.status] ?? inv.status
      const payMethod = inv.paymentMethod
        ? ((PAYMENT_TYPE_LABELS as Record<string, string>)[inv.paymentMethod] ?? inv.paymentMethod)
        : ''
      const contactName = inv.contact?.name ?? inv.guestName ?? inv.companyName ?? inv.contactId ?? ''
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        contactName.toLowerCase().includes(q) ||
        (inv.roomNumber ?? '').toLowerCase().includes(q) ||
        statusLabel.toLowerCase().includes(q) ||
        payMethod.toLowerCase().includes(q) ||
        String(inv.amount).includes(q) ||
        String(inv.paidAmount).includes(q) ||
        String(inv.remainingBalance).includes(q) ||
        (inv.notes ?? '').toLowerCase().includes(q) ||
        (inv.guestName ?? '').toLowerCase().includes(q) ||
        (inv.companyName ?? '').toLowerCase().includes(q)
      )
    })
  }, [invoices, searchQuery])

  const statusOptions = useMemo(() => [
    { label: t('common.all'), value: 'all' as const },
    ...Object.entries(INVOICE_STATUS_LABELS).map(([key, label]) => ({
      label,
      value: key,
    })),
  ], [t])

  const handleCreateClick = useCallback(() => {
    getNextNumber()
    setWizardMode('from-booking')
  }, [getNextNumber])

  const handleEditClick = useCallback((invoice: Invoice) => {
    setEditingInvoice(invoice)
  }, [])

  const handlePayClick = useCallback((invoice: Invoice) => {
    setPayingInvoice(invoice)
  }, [])

  const handleVoidClick = useCallback((invoice: Invoice) => {
    setVoidingInvoice(invoice)
  }, [])

  const handleRefundClick = useCallback((invoice: Invoice) => {
    setRefundingInvoice(invoice)
  }, [])

  const handleDiscountClick = useCallback((invoice: Invoice) => {
    setDiscountingInvoice(invoice)
  }, [])

  const handleViewClick = useCallback((invoice: Invoice) => {
    setViewInvoiceId(invoice.id)
  }, [])

  const handleDeleteClick = useCallback((invoice: Invoice) => {
    if (!canDeleteInvoices) {
      setDeletePermissionModalOpen(true)
      return
    }
    setDeletingInvoice(invoice)
  }, [canDeleteInvoices])

  const handlePrintPdf = useCallback(async (invoice: Invoice) => {
    setPrintingId(invoice.id)
    try {
      const full = invoice.items?.length ? invoice : await fetch(`/api/accounting/invoices/${invoice.id}`).then(r => r.ok ? r.json() : Promise.resolve(null)).then(j => (j?.data ?? j) as Invoice)
      await downloadInvoicePdf(full ?? invoice, locale)
    } finally {
      setPrintingId(null)
    }
  }, [locale])

  const handleExportCsv = useCallback(() => {
    exportInvoicesCsv(filteredInvoices, `invoices-${new Date().toISOString().slice(0, 10)}.csv`)
  }, [filteredInvoices])

  const handleExportPdf = useCallback(() => {
    void exportInvoicesListPdf(filteredInvoices, locale as 'en' | 'ar', `invoices-${new Date().toISOString().slice(0, 10)}.pdf`)
  }, [filteredInvoices, locale])

  const handleIssue = useCallback(async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/accounting/invoices/${invoice.id}/issue`, { method: 'POST' })
      if (res.ok) loadById(invoice.id)
    } catch { /* handled */ }
  }, [loadById])

  const columns: TableColumn<InvoiceTableRow>[] = useMemo(() => [
    {
      key: 'invoiceNumber',
      label: t('accounting.invoices.invoiceNumber'),
      render: (v, row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handlePrintPdf(row) }}
          disabled={printingId === row.id}
          className="cursor-pointer text-sm font-medium text-[#346538] underline underline-offset-2 hover:text-[#1A1A1A] transition-colors disabled:cursor-wait disabled:opacity-50"
        >
          {printingId === row.id ? (
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {String(v)}
            </span>
          ) : String(v)}
        </button>
      ),
    },
    {
      key: 'contactId',
      label: t('accounting.invoices.contact'),
      render: (_v, row) => row.contact?.name ?? row.guestName ?? row.contactId,
    },
    {
      key: 'roomNumber',
      label: t('accounting.invoices.roomNumber'),
      render: (v) => (v as string) ?? '-',
    },
    {
      key: 'status',
      label: t('accounting.invoices.status'),
      render: (v) => (
        <StatusBadge
          status={String(v)}
          variant={getStatusVariant(String(v))}
          label={INVOICE_STATUS_LABELS[String(v)] ?? String(v)}
        />
      ),
    },
    {
      key: 'paymentMethod',
      label: t('accounting.invoices.paymentMethod'),
      render: (v) => v ? ((PAYMENT_TYPE_LABELS as Record<string, string>)[String(v)] ?? String(v)) : '-',
    },
    {
      key: 'amount',
      label: t('accounting.invoices.amount'),
      render: (v, row) => formatCurrency(Number(v), row.currency as CurrencyCode),
    },
    {
      key: 'discount',
      label: t('accounting.invoices.discount'),
      render: (v, row) => {
        const discount = Number(v)
        return discount > 0
          ? <span className="text-[#9F2F2D]">-{formatCurrency(discount, row.currency as CurrencyCode)}</span>
          : <span className="text-[#A8A29E]">-</span>
      },
    },
    {
      key: 'paidAmount',
      label: t('accounting.invoices.paid'),
      render: (v, row) => formatCurrency(Number(v), row.currency as CurrencyCode),
    },
    {
      key: 'refundedAmount',
      label: t('accounting.invoices.refund'),
      render: (v, row) => {
        const refunded = Number(v)
        return refunded > 0
          ? <span className="text-[#9F2F2D]">{formatCurrency(refunded, row.currency as CurrencyCode)}</span>
          : <span className="text-[#A8A29E]">-</span>
      },
    },
    {
      key: 'remainingBalance',
      label: t('accounting.invoices.balance'),
      render: (v, row) => {
        const bal = Number(v)
        return (
          <span className={bal > 0 ? 'text-amber-600 font-medium' : 'text-[#787774]'}>
            {formatCurrency(bal, row.currency as CurrencyCode)}
          </span>
        )
      },
    },
    {
      key: 'dueDate',
      label: t('accounting.invoices.dueDate'),
      render: (v) => {
        const d = v as string
        if (!d) return '-'
        const today = new Date()
        const due = new Date(d + 'T23:59:59')
        const isOverdue = due < today
        return (
          <span className={isOverdue ? 'text-[#9F2F2D] font-medium' : ''}>
            {formatDate(d, locale)}
          </span>
        )
      },
    },
    {
      key: 'id',
      label: '',
      render: (_v, row) => (
        <TableActionsMenu
          actions={[
            { label: t('accounting.invoices.actions.viewDetail'), onSelect: () => handleViewClick(row) },
            { label: t('accounting.invoices.actions.printPdf') || 'Print PDF', onSelect: () => handlePrintPdf(row) },
            ...(row.status === 'draft' || row.status === 'issued' ? [{ label: row.status === 'draft' ? t('accounting.invoices.actions.editDraft') : 'Edit', onSelect: () => handleEditClick(row) }] : []),
            ...(row.status === 'draft' ? [{ label: t('accounting.invoices.actions.issueInvoice'), onSelect: () => handleIssue(row) }] : []),
            ...(row.status === 'issued' || row.status === 'partially_paid' ? [{ label: t('accounting.invoices.actions.recordPayment'), onSelect: () => handlePayClick(row) }] : []),
            ...(canAdjustInvoices && row.status !== 'void' && row.status !== 'refunded' ? [{ label: t('accounting.invoices.actions.applyDiscount'), onSelect: () => handleDiscountClick(row) }] : []),
            ...(row.status !== 'void' && row.status !== 'refunded' && row.status !== 'paid' ? [{ label: t('accounting.invoices.actions.voidInvoice'), onSelect: () => handleVoidClick(row), destructive: true }] : []),
            ...(row.status === 'paid' || row.status === 'partially_paid' || row.status === 'partially_refunded' ? [{ label: t('accounting.invoices.actions.refundInvoice'), onSelect: () => handleRefundClick(row), destructive: true }] : []),
            ...(canDeleteInvoices ? [{ label: t('common.delete'), onSelect: () => handleDeleteClick(row), destructive: true }] : []),
          ]}
          ariaLabel={t('common.actions')}
        />
      ),
    },
  ], [t, formatCurrency, locale, handleViewClick, handleEditClick, handleIssue, handlePayClick, handleVoidClick, handleRefundClick, handlePrintPdf, handleDeleteClick, handleDiscountClick, printingId, canDeleteInvoices, canAdjustInvoices])

  return (
    <div className="space-y-6">
      <InvoiceSummaryCards invoices={filteredInvoices} t={t} />

      <div className="space-y-3 border-y border-[#EAEAEA] py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 lg:w-[22.5rem]">
            <ToolbarSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('common.search')}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <ToolbarViewToggle
              view={viewMode}
              onChange={setViewMode}
              rowLabel={t('accounting.invoices.rowView')}
              gridLabel={t('accounting.invoices.gridView')}
            />
            <ToolbarExportGroup
              onExportCsv={handleExportCsv}
              onExportPdf={handleExportPdf}
              csvLabel="CSV"
              pdfLabel="PDF"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(11rem,14rem)_minmax(10rem,12rem)_minmax(10rem,12rem)]">
          <FloatingSelect
            label={t('accounting.invoices.status')}
            wrapperClassName="w-full"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </FloatingSelect>
          <input
            type="date"
            value={dateRangeStart}
            onChange={(e) => setDateRangeStart(e.target.value)}
            className="h-9 w-full rounded-lg border border-[#EAEAEA] px-3 text-sm"
            aria-label={t('accounting.invoices.issueDate')}
          />
          <input
            type="date"
            value={dateRangeEnd}
            onChange={(e) => setDateRangeEnd(e.target.value)}
            className="h-9 w-full rounded-lg border border-[#EAEAEA] px-3 text-sm"
            aria-label={t('accounting.invoices.dueDate')}
          />
        </div>
      </div>

      {viewMode === 'row' ? (
        <Table
          data={filteredInvoices as InvoiceTableRow[]}
          columns={columns}
          loading={loading}
          pageSize={10}
          pageSizeOptions={[10, 20, 50, 100]}
          sortable={false}
        />
      ) : (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredInvoices.map((invoice) => (
            <InvoiceGridCard
              key={invoice.id}
              invoice={invoice}
              t={t}
              onView={handleViewClick}
              onEdit={handleEditClick}
              onPay={handlePayClick}
              onVoid={handleVoidClick}
              onRefund={handleRefundClick}
              onDelete={handleDeleteClick}
              onPrintPdf={handlePrintPdf}
              printingId={printingId}
              onIssue={handleIssue}
              onDiscount={canAdjustInvoices ? handleDiscountClick : undefined}
            />
          ))}
        </div>
      )}

      {wizardMode && (
        <InvoiceComposerModal
          t={t}
          mode={wizardMode}
          onClose={() => setWizardMode(null)}
          onSaved={() => {
            setWizardMode(null)
            refresh(filters)
          }}
        />
      )}

      {editingInvoice && (
        <InvoiceComposerModal
          t={t}
          mode="edit-draft"
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSaved={() => {
            setEditingInvoice(null)
            refresh(filters)
          }}
        />
      )}

      {viewInvoiceId && (
        <InvoiceDetailModal
          invoiceId={viewInvoiceId}
          t={t}
          onClose={() => {
            setViewInvoiceId(null)
            refresh(filters)
          }}
          onEdit={(inv) => {
            setViewInvoiceId(null)
            setEditingInvoice(inv)
          }}
        />
      )}

      {payingInvoice && (
        <InvoicePaymentsModal
          invoiceId={payingInvoice.id}
          invoiceAmount={payingInvoice.amount}
          currency={payingInvoice.currency}
          contactName={payingInvoice.contact?.name ?? payingInvoice.guestName ?? ''}
          onClose={() => setPayingInvoice(null)}
          onPaymentChanged={() => {
            setPayingInvoice(null)
            refresh(filters)
          }}
          t={t}
        />
      )}

      {discountingInvoice && (
        <DiscountInvoiceDialog
          invoice={discountingInvoice}
          t={t}
          onClose={() => setDiscountingInvoice(null)}
          onApplied={() => {
            setDiscountingInvoice(null)
            refresh(filters)
          }}
        />
      )}

      {voidingInvoice && (
        <VoidConfirmDialog
          invoice={voidingInvoice}
          t={t}
          onClose={() => setVoidingInvoice(null)}
          onVoided={() => {
            setVoidingInvoice(null)
            refresh(filters)
          }}
        />
      )}

      {refundingInvoice && (
        <RefundConfirmDialog
          invoice={refundingInvoice}
          t={t}
          onClose={() => setRefundingInvoice(null)}
          onRefunded={() => {
            setRefundingInvoice(null)
            refresh(filters)
          }}
        />
      )}

      {deletingInvoice && (
        <DeleteInvoiceDialog
          invoice={deletingInvoice}
          t={t}
          onClose={() => setDeletingInvoice(null)}
          onDeleted={() => {
            setDeletingInvoice(null)
            refresh(filters)
          }}
        />
      )}

      <Modal isOpen={deletePermissionModalOpen} onClose={() => setDeletePermissionModalOpen(false)} title={t('common.permissionDeniedTitle')} size="md">
        <div className="space-y-4">
          <p className="text-sm text-[#374151]">{t('accounting.invoices.deletePermissionDenied')}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setDeletePermissionModalOpen(false)}
              className="cursor-pointer rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#333333]"
            >
              {t('common.ok')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
