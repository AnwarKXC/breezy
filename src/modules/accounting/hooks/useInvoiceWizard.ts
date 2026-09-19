'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useBookingValidation } from './useBookingValidation'
import { fetchInvoiceFormLookups } from '../services/accountingApiClient'
import {
  computeSubtotal,
  computeDiscount,
  computeServiceCharge,
  computeTax,
  computeTotal,
  computeTotalPayments,
  computeBalanceDue,
  validateStep,
  validateSubmitPayload,
} from '../utils/invoiceWizardValidation'
import type {
  WizardMode,
  WizardState,
  WizardItem,
  Invoice,
  InvoiceItem,
  InvoiceBookingLookup,
  InvoiceItemType,
  PaymentType,
  BookingWarning,
} from '../types'
import type { Contact } from '@/modules/contacts/types'
import {
  createInitialState,
  hydrateWizardState,
} from '../utils/invoiceWizardState'

function useComputedValues(state: WizardState) {
  return useMemo(() => {
    const subtotal = computeSubtotal(state.items)
    const totalDiscount = computeDiscount(subtotal, state.discount)
    const serviceChargeAmount = computeServiceCharge(subtotal, state.serviceCharge)
    const taxAmount = computeTax(subtotal, totalDiscount, serviceChargeAmount, state.taxRate)
    const total = computeTotal(subtotal, totalDiscount, serviceChargeAmount, taxAmount)
    const totalPayments = computeTotalPayments(state.payments)
    const depositApplied = state.applyDeposit ? state.depositAmount : 0
    const balanceDue = computeBalanceDue(total, depositApplied, totalPayments)
    const stepValidation = validateStep(state, state.step)
    const canProceed = stepValidation.valid

    return {
      subtotal,
      totalDiscount,
      serviceChargeAmount,
      taxAmount,
      total,
      totalPayments,
      depositApplied,
      balanceDue,
      canProceed,
      stepErrors: stepValidation.errors,
      stepWarnings: stepValidation.warnings,
    }
  }, [
    state.items,
    state.discount,
    state.serviceCharge,
    state.taxRate,
    state.payments,
    state.applyDeposit,
    state.depositAmount,
    state.step,
  ])
}

export function useInvoiceWizard(
  mode: WizardMode,
  existingInvoicesMap?: Map<string, string[]>,
  invoice?: Invoice & { items?: InvoiceItem[] },
) {
  const [state, setState] = useState<WizardState>(() => createInitialState(mode, invoice))
  const { validate } = useBookingValidation({ existingInvoicesMap })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => hydrateWizardState(prev, mode, invoice))
  }, [mode, invoice?.id, invoice?.items?.length])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    fetchInvoiceFormLookups(controller.signal)
      .then((data) => {
        if (!cancelled) setState((prev) => ({ ...prev, lookups: data, lookupsLoading: false }))
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ ...prev, lookupsLoading: false }))
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const computed = useComputedValues(state)

  const buildBookingCharges = useCallback((booking: InvoiceBookingLookup): WizardItem[] => {
    const charges: WizardItem[] = []
    if (booking.totalAmount && booking.totalAmount > 0) {
      charges.push({
        type: 'room_charge' as InvoiceItemType,
        description: `Room ${booking.roomNumber ?? ''} - ${booking.nights} night(s) (${booking.checkIn.slice(0, 10)} to ${booking.checkOut.slice(0, 10)})`,
        quantity: 1,
        unitPrice: booking.totalAmount,
        totalPrice: booking.totalAmount,
        discountAmount: 0,
        taxAmount: 0,
        originalPrice: booking.totalAmount,
      })
    }
    return charges
  }, [])

  const selectBooking = useCallback((booking: InvoiceBookingLookup) => {
    const warnings = validate(booking)
    const hasExisting = warnings.some((w) => w.type === 'existing_invoice')
    const existingIds = hasExisting
      ? (warnings.find((w) => w.type === 'existing_invoice')?.actions?.map(
          (a) => a.payload?.bookingId as string,
        ) ?? [])
      : []

    const charges = buildBookingCharges(booking)

    const noShowWarning = warnings.find((w) => w.type === 'no_show')
    if (noShowWarning) {
      charges.push({
        type: 'extra_service' as InvoiceItemType,
        description: 'No-show charge',
        quantity: 1,
        unitPrice: booking.totalAmount ?? 0,
        totalPrice: booking.totalAmount ?? 0,
        discountAmount: 0,
        taxAmount: 0,
      })
    }

    setState((prev) => ({
      ...prev,
      selectedBooking: booking,
      bookingId: booking.id,
      contactId: booking.contactId ?? prev.contactId,
      roomId: booking.roomId ?? prev.roomId,
      roomNumber: booking.roomNumber ?? prev.roomNumber,
      guestName: booking.guestName ?? prev.guestName,
      companyName: booking.companyName ?? prev.companyName,
      items: charges.length > 0 ? charges : prev.items,
      warnings,
      hasExistingInvoices: hasExisting,
      existingInvoiceIds: existingIds as string[],
      applyDeposit: booking.paidAmount != null && booking.paidAmount > 0,
      depositAmount: booking.paidAmount ?? 0,
      errors: {},
      step: prev.mode === 'checkout' ? 1 : 1,
    }))
  }, [buildBookingCharges, validate])

  const selectContact = useCallback((contact: Contact | null) => {
    if (!contact) {
      setState((prev) => ({
        ...prev,
        contactId: '',
        selectedBooking: null,
        bookingId: '',
        roomId: '',
        roomNumber: '',
        warnings: [],
        hasExistingInvoices: false,
        existingInvoiceIds: [],
      }))
      return
    }

    const matchingBookings = state.lookups.bookings.filter((booking) => booking.contactId === contact.id)
    const onlyBooking = matchingBookings.length === 1 ? matchingBookings[0] : null

    if (state.mode !== 'manual' && onlyBooking) {
      const warnings = validate(onlyBooking)
      const hasExisting = warnings.some((w) => w.type === 'existing_invoice')
      const existingIds = hasExisting
        ? (warnings.find((w) => w.type === 'existing_invoice')?.actions?.map(
            (a) => a.payload?.bookingId as string,
          ) ?? [])
        : []
      const charges = buildBookingCharges(onlyBooking)

      setState((prev) => ({
        ...prev,
        selectedBooking: onlyBooking,
        bookingId: onlyBooking.id,
        contactId: contact.id,
        roomId: onlyBooking.roomId ?? prev.roomId,
        roomNumber: onlyBooking.roomNumber ?? prev.roomNumber,
        guestName: onlyBooking.guestName ?? (contact.type === 'individual' ? contact.name : prev.guestName),
        companyName: onlyBooking.companyName ?? (contact.type === 'company' ? contact.name : prev.companyName),
        items: charges.length > 0 ? charges : prev.items,
        warnings,
        hasExistingInvoices: hasExisting,
        existingInvoiceIds: existingIds as string[],
        applyDeposit: onlyBooking.paidAmount != null && onlyBooking.paidAmount > 0,
        depositAmount: onlyBooking.paidAmount ?? 0,
        errors: {},
        step: prev.mode === 'checkout' ? 1 : 1,
      }))
      return
    }

    setState((prev) => ({
      ...prev,
      contactId: contact.id,
      selectedBooking: prev.selectedBooking?.contactId === contact.id ? prev.selectedBooking : null,
      bookingId: prev.selectedBooking?.contactId === contact.id ? prev.bookingId : '',
      guestName: contact.type === 'individual' ? contact.name : prev.guestName,
      companyName: contact.type === 'company' ? contact.name : prev.companyName,
      errors: {},
    }))
  }, [buildBookingCharges, state.lookups.bookings, state.mode, validate])

  const setFn = <K extends keyof WizardState>(key: K) =>
    (value: WizardState[K] | ((prev: WizardState[K]) => WizardState[K])) => {
      setState((prev) => ({
        ...prev,
        [key]: typeof value === 'function'
          ? (value as (prev: WizardState[K]) => WizardState[K])(prev[key])
          : value,
      }))
    }

  const addItem = useCallback((type: InvoiceItemType = 'extra_service') => {
    setState((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { type, description: '', quantity: 1, unitPrice: 0, totalPrice: 0, discountAmount: 0, taxAmount: 0 },
      ],
    }))
  }, [])

  const updateItem = useCallback((idx: number, field: string, value: string | number) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === idx ? { ...item, [field]: value, totalPrice: field === 'unitPrice' || field === 'quantity' ? (field === 'unitPrice' ? Number(value) * item.quantity : item.unitPrice * Number(value)) : item.totalPrice } : item,
      ),
    }))
  }, [])

  const removeItem = useCallback((idx: number) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }))
  }, [])

  const addQuickCharge = useCallback(
    (type: InvoiceItemType, label: string, price: number, qty: number = 1) => {
      setState((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          { type, description: label, quantity: qty, unitPrice: price, totalPrice: price * qty, discountAmount: 0, taxAmount: 0 },
        ],
      }))
    }, [])

  const addPayment = useCallback(() => {
    setState((prev) => ({
      ...prev,
      payments: [...prev.payments, { amount: 0, method: 'cash' as PaymentType }],
    }))
  }, [])

  const updatePayment = useCallback(
    (idx: number, field: 'amount' | 'method', value: number | PaymentType) => {
      setState((prev) => ({
        ...prev,
        payments: prev.payments.map((p, i) =>
          i === idx ? { ...p, [field]: value } : p,
        ),
      }))
    }, [])

  const removePayment = useCallback((idx: number) => {
    setState((prev) => ({
      ...prev,
      payments: prev.payments.filter((_, i) => i !== idx),
    }))
  }, [])

  const nextStep = useCallback(() => {
    setState((prev) => {
      const validation = validateStep(prev, prev.step)
      if (!validation.valid) return { ...prev, errors: validation.errors }
      return { ...prev, step: Math.min(prev.step + 1, 3), errors: {} }
    })
  }, [])

  const prevStep = useCallback(() => {
    setState((prev) => ({ ...prev, step: Math.max(prev.step - 1, 0), errors: {} }))
  }, [])

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, step: Math.max(0, Math.min(step, 3)), errors: {} }))
  }, [])

  const updateWarnings = useCallback((warnings: BookingWarning[]) => {
    setState((prev) => ({ ...prev, warnings }))
  }, [])

  const createInvoice = useCallback(async (): Promise<{ id: string; invoiceNumber?: string }> => {
    const { buildCreatePayload } = await import('../utils/invoiceWizardValidation')
    const payload = buildCreatePayload(state)
    const res = await fetch('/api/accounting/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new Error(json?.error ?? 'Failed to create invoice')
    }
    const json = await res.json()
    return (json.data ?? json) as { id: string; invoiceNumber?: string }
  }, [state])

  const updateInvoice = useCallback(async (invoiceId: string): Promise<{ id: string; invoiceNumber?: string }> => {
    const { buildCreatePayload } = await import('../utils/invoiceWizardValidation')
    const payload = buildCreatePayload(state)
    const res = await fetch(`/api/accounting/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new Error(json?.error ?? 'Failed to update invoice')
    }
    const json = await res.json()
    return (json.data ?? json) as { id: string; invoiceNumber?: string }
  }, [state])

  const issueInvoice = useCallback(async (invoiceId: string): Promise<void> => {
    const res = await fetch(`/api/accounting/invoices/${invoiceId}/issue`, { method: 'POST' })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new Error(json?.error ?? 'Failed to issue invoice')
    }
  }, [])

  const recordPaymentApi = useCallback(
    async (invoiceId: string, invoiceNumber: string): Promise<void> => {
      for (const payment of state.payments) {
        if (payment.amount <= 0) continue
        const res = await fetch('/api/accounting/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: invoiceId,
            amount: payment.amount,
            type: payment.method,
            description: `Payment for invoice ${invoiceNumber}`,
          }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => null)
          throw new Error(json?.error ?? 'Invoice created but payment failed')
        }
      }
    },
    [state.payments],
  )

  const resetState = useCallback(() => {
    setState(createInitialState(mode, invoice))
  }, [mode, invoice])

  const validateForSubmit = useCallback(() => {
    const validation = validateSubmitPayload(state)
    setState((prev) => ({ ...prev, errors: validation.errors }))
    return validation
  }, [state])

  return {
    state,
    computed,
    actions: {
      selectBooking,
      selectContact,
      setGuestName: setFn('guestName'),
      setCompanyName: setFn('companyName'),
      setContactId: setFn('contactId'),
      setRoomId: setFn('roomId'),
      setRoomNumber: setFn('roomNumber'),
      setItems: setFn('items'),
      addItem,
      updateItem,
      removeItem,
      addQuickCharge,
      setIssueDate: setFn('issueDate'),
      setDueDate: setFn('dueDate'),
      setStatus: setFn('status'),
      setRecordPayment: setFn('recordPayment'),
      setPayments: setFn('payments'),
      addPayment,
      updatePayment,
      removePayment,
      setApplyDeposit: setFn('applyDeposit'),
      setDepositAmount: setFn('depositAmount'),
      setDiscount: setFn('discount'),
      setServiceCharge: setFn('serviceCharge'),
      setTaxRate: setFn('taxRate'),
      setPublicNotes: setFn('publicNotes'),
      setInternalNotes: setFn('internalNotes'),
      setSaving: setFn('saving'),
      setErrors: setFn('errors'),
      updateWarnings,
      nextStep,
      prevStep,
      goToStep,
      reset: resetState,
      validateForSubmit,
    },
    api: {
      createInvoice,
      updateInvoice,
      issueInvoice,
      recordPaymentApi,
    },
  }
}
