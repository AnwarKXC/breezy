'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { Modal } from '@/shared/components/Modal'
import { toast } from '@/shared/toast/toastEvents'
import type { Invoice } from '../types'

interface Props {
  invoice: Invoice
  t: (key: string) => string
  onClose: () => void
  onDeleted: () => void
}

export function DeleteInvoiceDialog({ invoice, t, onClose, onDeleted }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const hasLinkedStay = Boolean(invoice.reservationId)

  const handleDelete = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/accounting/invoices/${invoice.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Failed to delete invoice')
      }
      toast.success(t('accounting.invoices.toast.deleted') || 'Invoice deleted')
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice')
    } finally {
      setSubmitting(false)
    }
  }, [invoice.id, onDeleted, t])

  return (
    <Modal isOpen onClose={onClose} title={t('common.delete')} size="md">
      <form className="space-y-4" onSubmit={handleDelete}>
        <p className="text-sm text-[#555555]">
          {t('accounting.invoices.deleteConfirm') || 'Are you sure you want to delete this invoice? This action cannot be undone.'}
        </p>

        {hasLinkedStay && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {t('accounting.invoices.deleteLinkedStayWarning')
              || 'This invoice is linked to a reservation. Deleting it will also cancel that reservation for this day and free the room, unless the guest is already checked in (in that case deletion is blocked).'}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-[#FDEBEC] p-3 text-sm text-[#9F2F2D]">{error}</div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#D4D4D4] px-4 text-sm font-medium text-[#333333] hover:bg-[#F9F9F8]"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="h-9 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Deleting...' : t('common.delete')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
