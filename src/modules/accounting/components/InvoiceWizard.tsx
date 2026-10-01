'use client'

import { useState, useCallback, useMemo } from 'react'
import { Modal } from '@/shared/components/Modal'
import { CurrencyScope, useCurrency } from '@/shared/contexts/CurrencyContext'
import { useInvoiceWizard } from '../hooks/useInvoiceWizard'
import { InvoiceWizardWarnings } from './InvoiceWizardWarnings'
import { InvoiceWizardStepBooking } from './InvoiceWizardStepBooking'
import { InvoiceWizardStepCharges } from './InvoiceWizardStepCharges'
import { InvoiceWizardStepPayment } from './InvoiceWizardStepPayment'
import { InvoiceWizardStepConfirm } from './InvoiceWizardStepConfirm'
import type { WizardMode } from '../types'

interface Props {
  t: (key: string) => string
  mode: WizardMode
  existingInvoicesMap?: Map<string, string[]>
  onClose: () => void
  onCreated: () => void
}

const STEP_KEYS: Record<number, string> = {
  0: 'stepSelectBooking',
  1: 'stepReviewCharges',
  2: 'stepPaymentNotes',
  3: 'stepConfirm',
}

export function InvoiceWizard({ t, mode, existingInvoicesMap, onClose, onCreated }: Props) {
  const { formatCurrency: formatIn } = useCurrency()
  const { state, computed, actions, api } = useInvoiceWizard(mode, existingInvoicesMap)
  const formatCurrency = (amount: number) => formatIn(amount, state.selectedBooking?.currency)
  const [error, setError] = useState<string | null>(null)

  const titleKey = useMemo(() => {
    switch (mode) {
      case 'from-booking': return 'accounting.invoices.createFromBooking'
      case 'checkout': return 'accounting.invoices.checkOut'
      case 'manual': return 'accounting.invoices.create'
      case 'edit-draft': return 'accounting.invoices.editDraft'
      default: return 'accounting.invoices.create'
    }
  }, [mode])

  const hasErrorSeverity = state.warnings.some((w) => w.severity === 'error')
  const canProceedFromCurrentStep = computed.canProceed && !hasErrorSeverity

  const handleSubmit = useCallback(async (saveAsDraft: boolean = false) => {
    setError(null)
    actions.setSaving(true)
    try {
      const invoiceResult = await api.createInvoice(saveAsDraft)
      const invoiceId = invoiceResult.id

      if (!saveAsDraft && state.status === 'issued') {
        await api.issueInvoice(invoiceId)
      }

      if (!saveAsDraft && state.recordPayment && state.payments.some((p) => p.amount > 0)) {
        await api.recordPaymentApi(invoiceId, invoiceResult.id)
      }

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      actions.setSaving(false)
    }
  }, [state.status, state.recordPayment, state.payments, api, actions, onCreated])

  const handleSwitchToManual = useCallback(() => {
    onClose()
  }, [onClose])

  return (
    <Modal isOpen onClose={onClose} title={t(titleKey)} size="xl">
      {/* An invoice for a reservation is in the reservation's currency (enforced on the server). */}
      <CurrencyScope code={state.selectedBooking?.currency}>
      <div className="flex max-h-[min(84vh,860px)] min-w-0 flex-col">
        <div className="flex shrink-0 gap-1 border-b border-[#EAEAEA] pb-4">
          {[0, 1, 2, 3].map((i) => {
            const isActive = state.step === i
            const isPast = state.step > i
            const label = t(`accounting.invoices.wizard.${STEP_KEYS[i]}`)
            return (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs ${
                  isActive ? 'text-[#1A1A1A] font-medium' : isPast ? 'text-[#346538]' : 'text-[#787774]'
                }`}
              >
                <span
                  className={`grid h-6 w-6 rounded-full place-items-center text-[11px] font-bold ${
                    isActive
                      ? 'bg-[#1A1A1A] text-white'
                      : isPast
                        ? 'bg-emerald-100 text-[#346538]'
                        : 'bg-[#F5F5F5] text-[#787774]'
                  }`}
                >
                  {isPast ? '\u2713' : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
                {i < 3 && <span className="ml-1 text-[#BBBBBB]">\u2192</span>}
              </div>
            )
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-[#FDEBEC] p-3 text-sm text-[#9F2F2D]">{error}</div>
          )}

          <div className="mb-4">
            <InvoiceWizardWarnings warnings={state.warnings} />
          </div>
          {state.step === 0 && (
            <InvoiceWizardStepBooking
              t={t}
              mode={state.mode}
              lookups={state.lookups}
              lookupsLoading={state.lookupsLoading}
              selectedBooking={state.selectedBooking}
              contactId={state.contactId}
              guestName={state.guestName}
              companyName={state.companyName}
              onSelectBooking={actions.selectBooking}
              onSetGuestName={actions.setGuestName}
              onSetCompanyName={actions.setCompanyName}
              onSwitchToManual={handleSwitchToManual}
            />
          )}

          {state.step === 1 && (
            <InvoiceWizardStepCharges
              t={t}
              items={state.items}
              discount={state.discount}
              serviceCharge={state.serviceCharge}
              taxRate={state.taxRate}
              selectedBooking={state.selectedBooking}
              subtotal={computed.subtotal}
              totalDiscount={computed.totalDiscount}
              serviceChargeAmount={computed.serviceChargeAmount}
              taxAmount={computed.taxAmount}
              total={computed.total}
              formatCurrency={formatCurrency}
              onAddItem={actions.addItem}
              onUpdateItem={actions.updateItem}
              onRemoveItem={actions.removeItem}
              onAddQuickCharge={actions.addQuickCharge}
              onSetDiscount={actions.setDiscount}
              onSetServiceCharge={actions.setServiceCharge}
              onSetTaxRate={actions.setTaxRate}
            />
          )}

          {state.step === 2 && (
            <InvoiceWizardStepPayment
              t={t}
              recordPayment={state.recordPayment}
              payments={state.payments}
              applyDeposit={state.applyDeposit}
              depositAmount={state.depositAmount}
              issueDate={state.issueDate}
              dueDate={state.dueDate}
              publicNotes={state.publicNotes}
              internalNotes={state.internalNotes}
              total={computed.total}
              canShowDeposit={state.selectedBooking?.paidAmount != null && state.selectedBooking.paidAmount > 0}
              onSetRecordPayment={actions.setRecordPayment}
              onSetPayments={actions.setPayments}
              onAddPayment={actions.addPayment}
              onUpdatePayment={actions.updatePayment}
              onRemovePayment={actions.removePayment}
              onSetApplyDeposit={actions.setApplyDeposit}
              onSetIssueDate={actions.setIssueDate}
              onSetDueDate={actions.setDueDate}
              onSetPublicNotes={actions.setPublicNotes}
              onSetInternalNotes={actions.setInternalNotes}
            />
          )}

          {state.step === 3 && (
            <InvoiceWizardStepConfirm
              t={t}
              selectedBooking={state.selectedBooking}
              guestName={state.guestName}
              companyName={state.companyName}
              items={state.items}
              applyDeposit={state.applyDeposit}
              depositAmount={state.depositAmount}
              recordPayment={state.recordPayment}
              payments={state.payments}
              issueDate={state.issueDate}
              dueDate={state.dueDate}
              publicNotes={state.publicNotes}
              internalNotes={state.internalNotes}
              subtotal={computed.subtotal}
              totalDiscount={computed.totalDiscount}
              serviceChargeAmount={computed.serviceChargeAmount}
              taxAmount={computed.taxAmount}
              total={computed.total}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-[#EAEAEA] bg-white pt-4">
          <button
            type="button"
            onClick={state.step === 0 ? onClose : actions.prevStep}
            className="h-9 rounded-lg border border-[#D4D4D4] px-4 text-sm font-medium text-[#333333] hover:bg-[#F9F9F8]"
          >
            {state.step === 0 ? t('common.cancel') : t('common.back')}
          </button>
          <div className="flex items-center gap-3">
            {state.step === 0 && state.mode === 'from-booking' && (
              <button
                type="button"
                onClick={handleSwitchToManual}
                className="h-9 rounded-lg border border-[#D4D4D4] px-4 text-sm font-medium text-[#333333] hover:bg-[#F9F9F8]"
              >
                {t('accounting.invoices.wizard.manualInvoiceTitle')}
              </button>
            )}
            {state.step < 2 && (
              <button
                type="button"
                onClick={actions.nextStep}
                disabled={!canProceedFromCurrentStep}
                className="h-9 rounded-lg bg-[#1A1A1A] px-4 text-sm font-medium text-white hover:bg-[#333333] disabled:opacity-50"
              >
                {t('common.continue')}
              </button>
            )}
            {state.step === 2 && (
              <button
                type="button"
                onClick={actions.nextStep}
                className="h-9 rounded-lg bg-[#1A1A1A] px-4 text-sm font-medium text-white hover:bg-[#333333]"
              >
                {t('accounting.invoices.wizard.stepConfirm')}
              </button>
            )}
            {state.step === 3 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={state.saving}
                  className="h-9 rounded-lg border border-[#D4D4D4] px-4 text-sm font-medium text-[#333333] hover:bg-[#F9F9F8] disabled:opacity-50"
                >
                  {state.saving ? t('common.saving') : t('accounting.invoices.wizard.saveDraft')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={state.saving}
                  className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {state.saving ? t('common.saving') : t('accounting.invoices.issue')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </CurrencyScope>
    </Modal>
  )
}
