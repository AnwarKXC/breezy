'use client'

import { Modal } from './Modal'
import { useTranslation } from '@/i18n/hooks/useTranslation'

interface DeleteConfirmationDialogProps {
  cancelLabel: string
  confirmLabel: string
  description: string
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  loading?: boolean
}

export function DeleteConfirmationDialog({
  cancelLabel,
  confirmLabel,
  description,
  isOpen,
  onClose,
  onConfirm,
  title,
  loading = false,
}: DeleteConfirmationDialogProps) {
  const { t } = useTranslation()
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-5">
        <p className="text-sm leading-6 text-[#555555]">{description}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-[#D4D4D4] px-5 py-2.5 text-sm font-semibold text-[#333333] transition-colors hover:bg-[#F9F9F8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading ? t('common.deleting') : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
