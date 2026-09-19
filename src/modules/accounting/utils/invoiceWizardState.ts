import type {
  WizardMode,
  WizardState,
  WizardItem,
  Invoice,
  InvoiceItem,
  InvoiceFormLookups,
} from '../types'

export const EMPTY_LOOKUPS: InvoiceFormLookups = { bookings: [], contacts: [], rooms: [] }

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function defaultDueDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

export function mapInvoiceItemsToWizardItems(items?: InvoiceItem[]): WizardItem[] {
  return (items ?? []).map((item) => ({
    type: item.type as WizardItem['type'],
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    discountAmount: item.discountAmount,
    taxAmount: item.taxAmount,
  }))
}

export function createInitialState(
  mode: WizardMode,
  invoice?: Invoice & { items?: InvoiceItem[] },
): WizardState {
  const invoiceItems = mapInvoiceItemsToWizardItems(invoice?.items)

  return {
    mode,
    step: mode === 'from-booking' ? 0 : 1,
    selectedBooking: null,
    contactId: invoice?.contactId ?? '',
    guestName: invoice?.guestName ?? '',
    companyName: invoice?.companyName ?? '',
    roomId: invoice?.roomId ?? '',
    roomNumber: invoice?.roomNumber ?? '',
    bookingId: invoice?.reservationId ?? '',
    items: invoiceItems,
    issueDate: invoice?.issueDate ?? today(),
    dueDate: invoice?.dueDate ?? defaultDueDate(),
    status: 'draft',
    recordPayment: false,
    payments: [],
    applyDeposit: false,
    depositAmount: 0,
    discount: invoice && invoice.discount > 0 ? { type: 'fixed', value: invoice.discount, reason: '', approvedBy: null } : null,
    serviceCharge: invoice?.subtotal ? Number(((invoice.serviceCharge / invoice.subtotal) * 100).toFixed(2)) : 0,
    taxRate: invoice?.subtotal ? Number(((invoice.taxAmount / Math.max(1, invoice.subtotal - invoice.discount + invoice.serviceCharge)) * 100).toFixed(2)) : 14,
    publicNotes: invoice?.publicNotes ?? '',
    internalNotes: invoice?.internalNotes ?? '',
    warnings: [],
    errors: {},
    saving: false,
    lookups: EMPTY_LOOKUPS,
    lookupsLoading: true,
    hasExistingInvoices: false,
    existingInvoiceIds: [],
    priceOverrides: [],
  }
}

function hasInvoiceItems(invoice?: Invoice & { items?: InvoiceItem[] }): boolean {
  return Boolean(invoice?.items && invoice.items.length > 0)
}

// Hydrates the wizard state when the edited invoice changes.
// Regression fix: an invoice loaded from the list API has NO items, so the
// wizard used to show a zero amount. When the full invoice (with items)
// arrives we must prefer the invoice's own items/discount/tax over the
// previous (possibly stale) state — otherwise the amount renders as 0 and a
// save would zero out the invoice.
export function hydrateWizardState(
  prev: WizardState,
  mode: WizardMode,
  invoice?: Invoice & { items?: InvoiceItem[] },
): WizardState {
  const fresh = createInitialState(mode, invoice)
  const loadedItems = hasInvoiceItems(invoice)

  return {
    ...fresh,
    contactId: prev.contactId || invoice?.contactId || '',
    guestName: prev.guestName || '',
    companyName: prev.companyName || '',
    items: loadedItems ? fresh.items : prev.items,
    discount: loadedItems ? fresh.discount : prev.discount,
    serviceCharge: loadedItems ? fresh.serviceCharge : prev.serviceCharge,
    taxRate: loadedItems ? fresh.taxRate : prev.taxRate,
    publicNotes: prev.publicNotes || '',
    internalNotes: prev.internalNotes || '',
    lookups: prev.lookups,
    lookupsLoading: prev.lookupsLoading,
  }
}
