'use client'

import { useState, useCallback } from 'react'
import type { ReservationDetail } from '@/modules/reservations/types'
import { toast } from '@/shared/toast/toastEvents'
import { BookingDeleteModal } from '@/modules/bookings/components/BookingDeleteModal'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Modal } from '@/shared/components/Modal'
import { InfoHint } from '@/shared/components/InfoHint'

interface Props {
  detail: ReservationDetail
  onRefresh: () => void
  onDeleted?: () => void
  onEdit?: (detail: ReservationDetail) => void
}

const ACTION_MAP: Record<
  string,
  { action: string; label: string; method: string; endpoint: string; tone?: 'primary' | 'danger' | 'quiet' }[]
> = {
  // `label` is an i18n key under reservations.actionBar; `${label}Hint` explains the consequence.
  draft: [
    { action: 'confirm', label: 'confirm', method: 'POST', endpoint: 'confirm', tone: 'primary' },
    { action: 'delete', label: 'delete', method: 'DELETE', endpoint: '', tone: 'danger' },
  ],
  held: [
    { action: 'confirm', label: 'confirm', method: 'POST', endpoint: 'confirm', tone: 'primary' },
    { action: 'cancel', label: 'cancel', method: 'POST', endpoint: 'cancel', tone: 'danger' },
  ],
  confirmed: [
    { action: 'check-in', label: 'checkIn', method: 'POST', endpoint: 'check-in', tone: 'primary' },
    { action: 'cancel', label: 'cancel', method: 'POST', endpoint: 'cancel', tone: 'danger' },
  ],
  checked_in: [],
  checked_out: [],
  cancelled: [],
  no_show: [],
  expired: [],
  failed: [],
}

const BUTTON_STYLES = {
  primary: 'bg-[#1A1A1A] text-white hover:bg-[#333333]',
  danger: 'bg-white text-rose-700 border border-[#EAEAEA] hover:bg-rose-50',
  quiet: 'bg-white text-[#333333] border border-[#EAEAEA] hover:bg-[#F9F9F8]',
}

export function ReservationActions({ detail, onRefresh, onDeleted, onEdit }: Props) {
  const { t } = useTranslation()
  const tr = useCallback((key: string) => t(`reservations.actionBar.${key}`), [t])
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelFeeAmount, setCancelFeeAmount] = useState('')

  const [deleteInvoiceOpen, setDeleteInvoiceOpen] = useState(false)
  const [deleteInvoiceData, setDeleteInvoiceData] = useState<{
    invoice: { id: string; invoiceNumber: string; status: string; amount: number }
    guestName: string
  } | null>(null)
  const [deleteInvoiceLoading, setDeleteInvoiceLoading] = useState(false)

  const handleAction = async (actionCfg: {
    action: string
    label: string
    method: string
    endpoint: string
  }) => {
    if (actionCfg.action === 'delete') {
      const listRes = await fetch(`/api/accounting/invoices?reservationId=${encodeURIComponent(detail.id)}`)
      if (listRes.ok) {
        const listJson = await listRes.json()
        const invoices = listJson.data ?? []
        const invoice = Array.isArray(invoices) ? invoices[0] : null
        if (invoice?.id) {
          const primaryGuest = detail.guests.find((g) => g.is_primary) ?? detail.guests[0]
          setDeleteInvoiceData({
            invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: invoice.status, amount: invoice.amount },
            guestName: primaryGuest?.full_name ?? 'Guest',
          })
          setDeleteInvoiceOpen(true)
          return
        }
      }
      setConfirmDelete(true)
      return
    }

    if (actionCfg.action === 'cancel') {
      setCancelFeeAmount(String(detail.total_amount ?? ''))
      setConfirmCancel(true)
      return
    }
    setLoading(actionCfg.action)

    try {
      const url = actionCfg.endpoint
        ? `/api/reservations/${detail.id}/${actionCfg.endpoint}`
        : `/api/reservations/${detail.id}`
      const res = await fetch(url, { method: actionCfg.method })
      const data = await res.json()
      if (data.ok) {
        onRefresh()
        toast.success(tr('success'))
      } else {
        toast.error(data.error?.message ?? tr('failed'))
      }
    } catch {
      toast.error(tr('networkError'))
    } finally {
      setLoading(null)
    }
  }

  const handleDeleteReservation = useCallback(async (id: string) => {
    const res = await fetch(`/api/reservations/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) {
      onDeleted?.()
      toast.success(tr('deleted'))
    } else {
      toast.error(data.error?.message ?? tr('deleteFailed'))
    }
  }, [onDeleted, tr])

  const handleDeleteConfirmed = async () => {
    setLoading('delete')
    try {
      const res = await fetch(`/api/reservations/${detail.id}`, { method: 'DELETE' })
      const data = await res.json()
      setConfirmDelete(false)
      if (data.ok) {
        onDeleted?.()
        toast.success(tr('deleted'))
      } else {
        toast.error(data.error?.message ?? tr('deleteFailed'))
      }
    } catch {
      setConfirmDelete(false)
      toast.error(tr('networkError'))
    } finally {
      setLoading(null)
    }
  }

  const doCancel = useCallback(async (feeAmount?: number) => {
    setLoading('cancel')
    try {
      const body = feeAmount && feeAmount > 0 ? JSON.stringify({ feeAmount }) : JSON.stringify({})
      const res = await fetch(`/api/reservations/${detail.id}/cancel`, { method: 'POST', body })
      const data = await res.json()
      setConfirmCancel(false)
      if (data.ok) {
        onRefresh()
        toast.success(data.invoice ? tr('cancelledWithInvoice') : tr('cancelled'))
      } else {
        toast.error(data.error?.message ?? tr('cancelFailed'))
      }
    } catch {
      setConfirmCancel(false)
      toast.error(tr('networkError'))
    } finally {
      setLoading(null)
    }
  }, [detail.id, onRefresh, tr])

  const handleChargeReservation = useCallback(async () => {
    if (!deleteInvoiceData) return
    setDeleteInvoiceLoading(true)
    try {
      const detailRes = await fetch(`/api/accounting/invoices/${deleteInvoiceData.invoice.id}`)
      if (detailRes.ok) {
        const detailJson = await detailRes.json()
        const fullInvoice = detailJson.data ?? detailJson
        toast.success(`Invoice #${deleteInvoiceData.invoice.invoiceNumber} — $${Number(deleteInvoiceData.invoice.amount).toFixed(2)} will be charged`)
        const { downloadInvoicePdf } = await import('@/modules/accounting/utils/invoicePdfExport')
        await downloadInvoicePdf(fullInvoice, 'en').catch((e) => console.error('[ReservationActions] PDF failed', e))
      }

      await handleDeleteReservation(detail.id)
    } catch {
      toast.error('Failed to delete reservation')
    } finally {
      setDeleteInvoiceLoading(false)
      setDeleteInvoiceOpen(false)
      setDeleteInvoiceData(null)
    }
  }, [deleteInvoiceData, detail.id, handleDeleteReservation])

  const handleDeleteInvoiceAndReservation = useCallback(async () => {
    if (!deleteInvoiceData) return
    setDeleteInvoiceLoading(true)
    try {
      const res = await fetch(`/api/accounting/invoices/${deleteInvoiceData.invoice.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error?.message ?? 'Failed to delete invoice')
        return
      }

      await handleDeleteReservation(detail.id)
    } catch {
      toast.error('Failed to delete reservation')
    } finally {
      setDeleteInvoiceLoading(false)
      setDeleteInvoiceOpen(false)
      setDeleteInvoiceData(null)
    }
  }, [deleteInvoiceData, detail.id, handleDeleteReservation])

  const handleDownloadInvoiceFromDelete = useCallback(async () => {
    if (!deleteInvoiceData) return
    try {
      const detailRes = await fetch(`/api/accounting/invoices/${deleteInvoiceData.invoice.id}`)
      if (!detailRes.ok) return
      const detailJson = await detailRes.json()
      const fullInvoice = detailJson.data ?? detailJson
      const { downloadInvoicePdf } = await import('@/modules/accounting/utils/invoicePdfExport')
      await downloadInvoicePdf(fullInvoice, 'en')
    } catch (e) {
      console.error('Invoice PDF download failed', e)
      toast.error('Failed to generate invoice PDF')
    }
  }, [deleteInvoiceData])

  const actions = (ACTION_MAP[String(detail.status).toLowerCase()] ?? []).filter(
    (a) => a.action !== 'confirm' || new Date(detail.check_in_date) <= new Date()
  )
  const status = String(detail.status).toLowerCase()
  const canEdit = ['draft', 'held'].includes(status)

  if (actions.length === 0 && !canEdit) return null

  const closeCancel = () => {
    if (loading === 'cancel') return
    setConfirmCancel(false)
    setCancelFeeAmount('')
  }
  const feeValue = Number(cancelFeeAmount)

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.action}
            type="button"
            onClick={() => handleAction(a)}
            disabled={loading === a.action}
            aria-busy={loading === a.action}
            data-tooltip={tr(`${a.label}Hint`)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[a.tone ?? 'primary']}`}
          >
            {loading === a.action ? tr('processing') : tr(a.label)}
          </button>
        ))}
        {canEdit && onEdit && (
          <button
            type="button"
            onClick={() => onEdit(detail)}
            data-tooltip={tr('editHint')}
            className="rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]"
          >
            {tr('edit')}
          </button>
        )}
      </div>

      <Modal isOpen={confirmCancel} onClose={closeCancel} title={tr('cancelTitle')}>
        <p className="text-sm text-[#787774]">{tr('cancelDescription')}</p>
        <div className="mt-4">
          <label htmlFor="reservation-cancel-fee" className="flex items-center gap-1.5 text-xs font-medium text-[#787774]">
            {tr('cancelFee')}
            <InfoHint text={tr('cancelFeeHint')} />
          </label>
          <input
            id="reservation-cancel-fee"
            type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
            min="0"
            step="0.01"
            value={cancelFeeAmount}
            onChange={(e) => setCancelFeeAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#EAEAEA] px-3 py-2 text-sm text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/10"
            placeholder="0.00"
          />
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={closeCancel}
            disabled={loading === 'cancel'}
            className="rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8] disabled:opacity-50"
          >
            {tr('back')}
          </button>
          <button
            type="button"
            onClick={() => doCancel()}
            disabled={loading === 'cancel'}
            data-tooltip={tr('justCancelHint')}
            className="rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-rose-50 disabled:opacity-50"
          >
            {tr('justCancel')}
          </button>
          <button
            type="button"
            onClick={() => doCancel(feeValue || undefined)}
            disabled={loading === 'cancel' || !(feeValue > 0)}
            data-tooltip={tr('cancelWithFeeHint')}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {tr('cancelWithFee')}
          </button>
        </div>
      </Modal>

      <Modal isOpen={confirmDelete} onClose={() => { if (loading !== 'delete') setConfirmDelete(false) }} title={tr('deleteTitle')}>
        <p className="text-sm text-[#787774]">{tr('deleteDescription')}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]"
          >
            {tr('back')}
          </button>
          <button
            type="button"
            onClick={handleDeleteConfirmed}
            disabled={loading === 'delete'}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {loading === 'delete' ? t('common.deleting') : t('common.delete')}
          </button>
        </div>
      </Modal>

      <BookingDeleteModal
        isOpen={deleteInvoiceOpen}
        onClose={() => { setDeleteInvoiceOpen(false); setDeleteInvoiceData(null) }}
        onChargeBooking={handleChargeReservation}
        onDeleteInvoice={handleDeleteInvoiceAndReservation}
        onDownloadInvoice={handleDownloadInvoiceFromDelete}
        bookingGuestName={deleteInvoiceData?.guestName ?? ''}
        invoice={deleteInvoiceData?.invoice ?? null}
        chargeAmount={deleteInvoiceData?.invoice?.amount}
        chargeInvoiceNumber={deleteInvoiceData?.invoice?.invoiceNumber}
        loading={deleteInvoiceLoading}
      />
    </>
  )
}
