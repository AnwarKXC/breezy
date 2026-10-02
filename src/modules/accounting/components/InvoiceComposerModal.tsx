'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '@/shared/components/Modal'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { toast } from '@/shared/toast/toastEvents'
import { fetchInvoiceById } from '../services/accountingApiClient'
import { useInvoiceWizard } from '../hooks/useInvoiceWizard'
import { ContactSelect } from './ContactSelect'
import { InvoiceWizardWarnings } from './InvoiceWizardWarnings'
import { InvoiceWizardStepBooking } from './InvoiceWizardStepBooking'
import { InvoiceWizardStepCharges } from './InvoiceWizardStepCharges'
import { InvoiceWizardStepPayment } from './InvoiceWizardStepPayment'
import { InvoiceWizardStepConfirm } from './InvoiceWizardStepConfirm'
import type { Invoice, InvoiceItem, WizardMode } from '../types'
import { MoneyAmount } from '@/shared/components/MoneyTotals'

interface Props {
  t: (key: string) => string
  mode: WizardMode
  invoice?: Invoice
  existingInvoicesMap?: Map<string, string[]>
  onClose: () => void
  onSaved: () => void
}

type EditableInvoice = Invoice & { items?: InvoiceItem[] }

function titleForMode(mode: WizardMode, t: (key: string) => string) {
  switch (mode) {
    case 'from-booking': return t('accounting.invoices.createFromBooking')
    case 'checkout': return t('accounting.invoices.checkOut')
    case 'edit-draft': return t('accounting.invoices.editDraft')
    case 'manual':
    default:
      return t('accounting.invoices.create')
  }
}

export function InvoiceComposerModal({
  t,
  mode,
  invoice,
  existingInvoicesMap,
  onClose,
  onSaved,
}: Props) {
  const { formatCurrency } = useCurrency()
  const [activeMode, setActiveMode] = useState(mode)
  const [loadedInvoice, setLoadedInvoice] = useState<EditableInvoice | null>(
    invoice && invoice.items?.length ? invoice as EditableInvoice : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [editLoadFailed, setEditLoadFailed] = useState(false)

  const contactSectionRef = useRef<HTMLDivElement>(null)
  const bookingSectionRef = useRef<HTMLDivElement>(null)
  const chargesSectionRef = useRef<HTMLDivElement>(null)
  const paymentSectionRef = useRef<HTMLDivElement>(null)

  const errorSectionMap: Record<string, React.RefObject<HTMLDivElement | null>> = {
    contactId: contactSectionRef,
    booking: bookingSectionRef,
    guestName: bookingSectionRef,
    items: chargesSectionRef,
    issueDate: paymentSectionRef,
    dueDate: paymentSectionRef,
    payments: paymentSectionRef,
  }

  useEffect(() => {
    if (!invoice?.id || invoice.items?.length) return
    let cancelled = false
    fetchInvoiceById(invoice.id)
      .then((data) => {
        if (!cancelled) {
          setEditLoadFailed(false)
          setLoadedInvoice(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedInvoice(invoice as EditableInvoice)
          setEditLoadFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [invoice])

  const editableInvoice = loadedInvoice ?? (invoice as EditableInvoice | undefined)
  const isEdit = activeMode === 'edit-draft' && Boolean(editableInvoice?.id)
  const isLoadingEdit = isEdit && !editLoadFailed && !editableInvoice?.items?.length

  const { state, computed, actions, api } = useInvoiceWizard(activeMode, existingInvoicesMap, editableInvoice)

  const title = useMemo(() => titleForMode(activeMode, t), [activeMode, t])
  const hasErrorSeverity = state.warnings.some((warning) => warning.severity === 'error')

  const handleSwitchToManual = useCallback(() => {
    setActiveMode('manual')
  }, [])

  const handleSubmit = async (issueNow: boolean) => {
    setError(null)
    const validation = actions.validateForSubmit()
    if (!validation.valid || hasErrorSeverity) {
      setError(validation.warnings[0] ?? 'Please review the highlighted invoice fields.')
      const firstErrorKey = Object.keys(validation.errors).find(
        (key) => key in errorSectionMap,
      )
      if (firstErrorKey) {
        const ref = errorSectionMap[firstErrorKey]
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    actions.setSaving(true)
    try {
      const invoiceResult = isEdit && editableInvoice?.id
        ? await api.updateInvoice(editableInvoice.id)
        : await api.createInvoice()

      if (issueNow) {
        await api.issueInvoice(invoiceResult.id)
      }

      if (issueNow && !isEdit && state.recordPayment && state.payments.some((payment) => payment.amount > 0)) {
        await api.recordPaymentApi(
          invoiceResult.id,
          invoiceResult.invoiceNumber ?? editableInvoice?.invoiceNumber ?? invoiceResult.id,
        )
      }

      toast.success(
        isEdit
          ? t('accounting.invoices.toast.updated')
          : issueNow
            ? t('accounting.invoices.toast.created')
            : t('accounting.invoices.toast.draftSaved'),
      )
      onSaved()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save invoice'
      setError(message)
      toast.error(t('accounting.invoices.toast.saveFailed'), { description: message })
    } finally {
      actions.setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={title} size="xl">
      <div className="flex min-w-0 flex-col">
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <div className="min-w-0 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-[#FDEBEC] p-3 text-sm text-[#9F2F2D]">
                {error}
              </div>
            )}

            <InvoiceWizardWarnings warnings={state.warnings} />

            {isLoadingEdit ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-[#787774]">
                {t('common.loading')}
              </div>
            ) : (
              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
                <div className="min-w-0 space-y-4">
                  <section
                    ref={contactSectionRef}
                    className={`min-w-0 rounded-xl border p-4 ${state.errors.contactId ? 'border-red-400 bg-[#FDEBEC]/30' : 'border-[#EAEAEA]'}`}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-[#1A1A1A]">
                          {t('accounting.invoices.wizard.guestInfo')}
                        </h4>
                        <p className="text-xs text-[#787774]">
                          {t('accounting.invoices.wizard.selectBookingDescription')}
                        </p>
                      </div>
                      {activeMode !== 'manual' && (
                        <button
                          type="button"
                          onClick={handleSwitchToManual}
                          className="h-8 rounded-lg border border-[#D4D4D4] px-3 text-xs font-medium text-[#333333] hover:bg-accent/10"
                        >
                          {t('accounting.invoices.manual')}
                        </button>
                      )}
                    </div>
                    <div className="mb-4">
                      <ContactSelect
                        value={state.contactId}
                        onChange={actions.setContactId}
                        onSelectContact={actions.selectContact}
                        label={t('accounting.invoices.contact')}
                        required
                      />
                    </div>
                  </section>

                  <section
                    ref={bookingSectionRef}
                    className={`min-w-0 rounded-xl border p-4 ${state.errors.booking || state.errors.guestName ? 'border-red-400 bg-[#FDEBEC]/30' : 'border-[#EAEAEA]'}`}
                  >
                    <InvoiceWizardStepBooking
                      t={t}
                      mode={state.mode}
                      lookups={state.lookups}
                      lookupsLoading={state.lookupsLoading}
                      selectedBooking={state.selectedBooking}
                      contactId={state.contactId}
                      guestName={state.guestName}
                      companyName={state.companyName}
                      errors={state.errors}
                      onSelectBooking={actions.selectBooking}
                      onSetGuestName={actions.setGuestName}
                      onSetCompanyName={actions.setCompanyName}
                      onSwitchToManual={handleSwitchToManual}
                    />
                  </section>

                  <section
                    ref={chargesSectionRef}
                    className={`min-w-0 rounded-xl border p-4 ${state.errors.items ? 'border-red-400 bg-[#FDEBEC]/30' : 'border-[#EAEAEA]'}`}
                  >
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
                      errors={state.errors}
                      onAddItem={actions.addItem}
                      onUpdateItem={actions.updateItem}
                      onRemoveItem={actions.removeItem}
                      onAddQuickCharge={actions.addQuickCharge}
                      onSetDiscount={actions.setDiscount}
                      onSetServiceCharge={actions.setServiceCharge}
                      onSetTaxRate={actions.setTaxRate}
                    />
                  </section>
                </div>

                <aside className="min-w-0 space-y-4">
                  {!isEdit && (
                    <section
                      ref={paymentSectionRef}
                      className={`min-w-0 rounded-xl border p-4 ${state.errors.issueDate || state.errors.dueDate || state.errors.payments ? 'border-red-400 bg-[#FDEBEC]/30' : 'border-[#EAEAEA]'}`}
                    >
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
                        errors={state.errors}
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
                    </section>
                  )}

                  <section className="min-w-0 rounded-xl border border-[#EAEAEA] p-4">
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
                  </section>
                </aside>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex shrink-0 flex-col gap-3 border-t border-[#EAEAEA] bg-white pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <span className="text-[#787774]">{t('accounting.invoices.wizard.amountDue')}</span>
            <span className="ml-2 font-bold text-[#1A1A1A]"><MoneyAmount inline amount={computed.balanceDue} /></span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-[#D4D4D4] px-4 text-sm font-medium text-[#333333] hover:bg-accent/10"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(isEdit ? false : true)}
              disabled={state.saving || isLoadingEdit}
              className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {state.saving ? t('common.saving') : isEdit ? t('accounting.invoices.actions.updateInvoice') || 'Update Invoice' : t('accounting.invoices.issue')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
