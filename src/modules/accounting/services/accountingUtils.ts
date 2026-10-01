import type { CreateInvoiceInput, CreateInvoiceItemInput } from '../types'

export type InvoiceItemDraftInput = Omit<CreateInvoiceItemInput, 'invoice_id'> & {
  invoice_id?: string
}

export type CreateInvoiceDraftInput = Omit<CreateInvoiceInput, 'amount' | 'invoice_number'> & {
  amount?: number | string | null
  invoice_number?: string | null
}

export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().slice(0, 10)
}

export function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

export function calculateInvoiceTotals(input: {
  amount?: number | string | null
  discount?: number | string | null
  items?: InvoiceItemDraftInput[]
  service_charge?: number | string | null
  subtotal?: number | string | null
  tax_amount?: number | string | null
}) {
  const itemSubtotal = input.items?.reduce(
    (sum, item) => sum + Number(item.quantity ?? 1) * Number(item.unit_price ?? 0),
    0,
  )
  const subtotal = roundMoney(itemSubtotal !== undefined ? itemSubtotal : Number(input.subtotal ?? input.amount ?? 0))
  const discount = roundMoney(Number(input.discount ?? 0) + (input.items?.reduce((sum, item) => sum + Number(item.discount_amount ?? 0), 0) ?? 0))
  const taxAmount = roundMoney(Number(input.tax_amount ?? 0) + (input.items?.reduce((sum, item) => sum + Number(item.tax_amount ?? 0), 0) ?? 0))
  const serviceCharge = roundMoney(Number(input.service_charge ?? 0))
  const total = roundMoney(Math.max(0, subtotal - discount + taxAmount + serviceCharge))

  return { subtotal, discount, taxAmount, serviceCharge, total }
}

export function mapInvoiceItemsForInsert(invoiceId: string, items: InvoiceItemDraftInput[]) {
  return items.map((item, idx) => {
    const quantity = Number(item.quantity ?? 1)
    const unitPrice = Number(item.unit_price ?? 0)
    const discountAmount = Number(item.discount_amount ?? 0)
    const taxAmount = Number(item.tax_amount ?? 0)
    const totalPrice = roundMoney(Math.max(0, quantity * unitPrice - discountAmount + taxAmount))

    return {
      invoice_id: invoiceId,
      type: item.type,
      description: item.description ?? '',
      quantity,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_price: totalPrice,
      sort_order: item.sort_order ?? idx,
    }
  })
}
