import { applyPdfFonts, buildArabicDocDef, formatCurrency as formatPdfCurrency, formatPdfDate, getPdfMake, injectRTLOptions } from '@/shared/utils/pdfMake'
import { formatDate } from '@/shared/utils/date'

function downloadBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
import type { Invoice, InvoiceItem, Payment } from '../types'
import { INVOICE_ITEM_TYPE_LABELS, INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../types'
import { loadPdfBranding, pdfQrNode } from '@/shared/branding/pdfBranding'

type InvoiceForPdf = Invoice & { payments?: Payment[] }

export function getInvoicePdfTotals(invoice: Pick<Invoice, 'amount' | 'subtotal' | 'serviceCharge' | 'taxAmount'>) {
  // Trust the stored breakdown — it's the invoice of record. Only estimate
  // when subtotal itself was never populated (pre-breakdown legacy rows);
  // zero service/tax is a legitimate value (e.g. system VAT rate is 0%), not
  // a signal that the breakdown is missing.
  if (invoice.amount <= 0 || invoice.subtotal > 0) {
    return {
      subtotal: invoice.subtotal,
      tax: invoice.serviceCharge,
      vat: invoice.taxAmount,
    }
  }

  const subtotal = Math.round((invoice.amount / 1.254) * 100) / 100
  const tax = Math.round((subtotal * 0.10) * 100) / 100
  const vat = Math.round((invoice.amount - subtotal - tax) * 100) / 100
  return { subtotal, tax, vat }
}

export type PdfInvoiceItem = InvoiceItem & {
  roomNumber?: string
  occupancyCode?: string
  nights?: number
  ratePerNight?: number
  checkIn?: string
  checkOut?: string
}

export type PdfReservationRoom = {
  id?: string
  room_number?: string | null
  occupancy_code?: string | null
  adults?: number | null
  children?: number | null
  nights?: number | null
  rate_per_night?: number | string | null
  check_in_date?: string | null
  check_out_date?: string | null
  status?: string | null
  room_type?: { name?: string | null } | null
}

export type PdfReservation = {
  reservation_number?: string | null
  rooms: PdfReservationRoom[]
  guests: Array<{ reservation_room_id?: string | null; full_name?: string | null; is_primary?: boolean | null }>
}

/** The reservation behind an invoice (rooms + guests), or null when unlinked/unavailable. */
export async function fetchReservationForPdf(
  invoice: Pick<Invoice, 'notes'> & { reservationId?: string | null },
  fetcher: typeof fetch = fetch,
): Promise<PdfReservation | null> {
  const reservationId = invoice.reservationId ?? invoice.notes?.match(/reservation\s+([0-9a-f-]{36})/i)?.[1]
  if (!reservationId) return null
  try {
    const response = await fetcher(`/api/reservations/${reservationId}`)
    if (!response.ok) return null
    const data = (await response.json()).data
    if (!data) return null
    return {
      reservation_number: data.reservation_number ?? null,
      rooms: ((data.rooms ?? []) as PdfReservationRoom[]).filter((r) => r.status !== 'cancelled'),
      guests: data.guests ?? [],
    }
  } catch {
    return null
  }
}

/**
 * Attach room number / type / occupancy / nights / rate to room-charge lines.
 * Lines are matched by the room number in their description, and otherwise
 * (generic "Room charge" lines) to the first unused room with the same total.
 */
export function matchItemsToRooms(items: InvoiceItem[], rooms: PdfReservationRoom[]): PdfInvoiceItem[] {
  const unused = new Set(rooms)
  const roomTotal = (r: PdfReservationRoom) => Number(r.rate_per_night ?? 0) * Math.max(1, Number(r.nights ?? 1))

  return items.map((item) => {
    if (item.type !== 'room_charge') return item
    const number = item.description.match(/^Room\s+(\S+)\s+-/)?.[1]
    const room = [...unused].find((r) => (number ? r.room_number === number : Math.abs(roomTotal(r) - item.totalPrice) < 0.01))
    if (!room) return item
    unused.delete(room)
    return {
      ...item,
      roomNumber: room.room_number ?? undefined,
      roomTypeName: room.room_type?.name ?? item.roomTypeName,
      occupancyCode: room.occupancy_code ?? undefined,
      occupancy: Number(room.adults ?? 0) + Number(room.children ?? 0),
      nights: Math.max(1, Number(room.nights ?? 1)),
      ratePerNight: Number(room.rate_per_night ?? 0),
      checkIn: room.check_in_date?.slice(0, 10),
      checkOut: room.check_out_date?.slice(0, 10),
    }
  })
}

export async function enrichInvoiceItemsForPdf(
  invoice: Pick<Invoice, 'notes'> & { reservationId?: string | null },
  items: InvoiceItem[],
  fetcher: typeof fetch = fetch,
): Promise<PdfInvoiceItem[]> {
  if (!items.some((item) => item.type === 'room_charge')) return items
  const reservation = await fetchReservationForPdf(invoice, fetcher)
  return reservation ? matchItemsToRooms(items, reservation.rooms) : items
}

type LineRow = {
  title: string
  details: string[]
  qty: number
  nights: number | null
  unitPrice: number
  total: number
}

const OCCUPANCY_NAMES = {
  en: { S: 'Single', D: 'Double', T: 'Triple' },
  ar: { S: 'فردية', D: 'مزدوجة', T: 'ثلاثية' },
} as const

/**
 * Turn raw invoice lines into printable rows: identical room charges collapse
 * into one "N rooms" row, and service/tax lines are dropped (they print in the
 * totals block instead of being counted twice).
 */
export function buildInvoiceLineRows(
  items: PdfInvoiceItem[],
  opts: {
    stayNights: number | null
    itemLabel: (type: string) => string
    isRTL: boolean
    /** Reservation stay; rooms whose own dates differ (extended/shortened) print them. */
    stay?: { checkIn: string | null; checkOut: string | null }
    formatDate?: (value: string) => string
  },
): LineRow[] {
  const rows: LineRow[] = []
  const roomGroups = new Map<string, { row: LineRow; rooms: string[]; ownDates: string }>()
  const w = opts.isRTL
    ? { room: 'غرفة', rooms: 'غرف', night: 'ليلة', nights: 'ليالٍ' }
    : { room: 'Room', rooms: 'rooms', night: 'night', nights: 'nights' }
  const day = (d: string | null | undefined) => d?.slice(0, 10) ?? ''
  const fmt = opts.formatDate ?? ((d: string) => d)
  const occNames = OCCUPANCY_NAMES[opts.isRTL ? 'ar' : 'en']

  for (const item of items) {
    if (item.type === 'service_charge' || item.type === 'tax') continue
    const label = opts.itemLabel(item.type)
    const genericDescription = !item.description || item.description.trim().toLowerCase() === label.toLowerCase()

    if (item.type !== 'room_charge') {
      rows.push({
        title: label,
        details: genericDescription ? [] : [item.description],
        qty: item.quantity,
        nights: null,
        unitPrice: item.unitPrice,
        total: item.totalPrice,
      })
      continue
    }

    const nights = item.nights ?? opts.stayNights ?? (item.quantity > 1 ? item.quantity : null)
    const rate = item.ratePerNight ?? (nights ? item.totalPrice / nights : item.totalPrice)
    const occ = item.occupancyCode && item.occupancyCode in occNames ? occNames[item.occupancyCode as keyof typeof occNames] : null
    const title = [item.roomTypeName, occ].filter(Boolean).join(' · ') || label
    const ownDates =
      item.checkIn && item.checkOut && opts.stay
      && (item.checkIn !== day(opts.stay.checkIn) || item.checkOut !== day(opts.stay.checkOut))
        ? `${fmt(item.checkIn)} – ${fmt(item.checkOut)}`
        : ''
    const key = [title, nights, rate.toFixed(2), item.totalPrice.toFixed(2), ownDates].join('|')

    let group = roomGroups.get(key)
    if (!group) {
      group = { row: { title, details: [], qty: 0, nights, unitPrice: rate, total: 0 }, rooms: [], ownDates }
      roomGroups.set(key, group)
      rows.push(group.row)
    }
    group.row.qty += 1
    group.row.total += item.totalPrice
    if (item.roomNumber) group.rooms.push(item.roomNumber)
  }

  for (const { row, rooms, ownDates } of roomGroups.values()) {
    const sorted = [...rooms].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const count = row.qty > 1 ? `${row.qty} ${w.rooms}` : `1 ${w.room.toLowerCase()}`
    const nightsText = row.nights ? ` × ${row.nights} ${row.nights === 1 ? w.night : w.nights}` : ''
    row.details.push(`${count}${nightsText}${ownDates ? ` · ${ownDates}` : ''}`)
    if (sorted.length) row.details.push(sorted.join(', '))
  }
  return rows
}

/** "VAT (14%)" style label from the invoice's own service/tax line, if any. */
function percentLabel(items: InvoiceItem[], type: string, fallback: string): string {
  const pct = items.find((i) => i.type === type)?.description.match(/\(([\d.]+%)\)/)?.[1]
  return pct ? `${fallback} (${pct})` : fallback
}


function invoiceNumberLabel(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return `INV-${Date.now()}`
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `INV-${year}${month}${day}-${hour}${minute}`
}

function computeNights(checkIn: string | null | undefined, checkOut: string | null | undefined): number | null {
  if (!checkIn || !checkOut) return null
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const diff = end.getTime() - start.getTime()
  return Math.max(1, Math.round(diff / 86_400_000))
}

// ── Brand palette from logo (sage green #5E6B57 refined) ──
const C = {
  green: '#4A5B48',
  greenLight: '#7C8B76',
  greenBg: '#EDF0EB',
  warmBg: '#F8F9F7',
  white: '#FFFFFF',
  text: '#1C1C1C',
  textMuted: '#6B7280',
  border: '#E3E6E0',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
} as const

const EN_INVOICE_PDF_LABELS = {
  taxInvoice: "Invoice",
  invoice: "Invoice",
  invoiceNumber: "Invoice #:",
  status: "Status:",
  issueDate: "Issue Date:",
  dueDate: "Due Date:",
  room: "Room:",
  stay: "STAY",
  nights: "night(s)",
  billTo: "BILL TO",
  description: "Description",
  roomType: "Room Type",
  occupancy: "Occupancy",
  quantity: "Qty",
  perNight: "Per Night",
  unitPrice: "Unit Price",
  total: "Total",
  noLineItems: "No line items",
  subtotal: "Subtotal",
  discount: "Discount",
  tax: "Tax",
  serviceCharge: "Service charge",
  vat: "VAT",
  nightsHeader: "Nights",
  ratePerNight: "Rate / Night",
  confirmationNo: "Confirmation No.",
  paid: "Paid",
  refunded: "Refunded",
  balanceDue: "Balance Due",
  date: "Date",
  method: "Method",
  amount: "Amount",
  payments: "PAYMENTS",
  notes: "NOTES",
  internal: "Internal",
  thankYou: "Thank you for your stay",
  taxId: "Tax Reg. No.",
  page: "Page",
  of: "of",
} as const

const AR_INVOICE_PDF_LABELS: Record<keyof typeof EN_INVOICE_PDF_LABELS, string> = {
  taxInvoice: "\u0641\u0627\u062a\u0648\u0631\u0629",
  invoice: "\u0641\u0627\u062a\u0648\u0631\u0629",
  invoiceNumber: ": \u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629",
  status: ": \u0627\u0644\u062d\u0627\u0644\u0629",
  issueDate: ": \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u0635\u062f\u0627\u0631",
  dueDate: ": \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0627\u0633\u062a\u062d\u0642\u0627\u0642",
  room: ": \u0627\u0644\u063a\u0631\u0641\u0629",
  stay: "\u0627\u0644\u0625\u0642\u0627\u0645\u0629",
  nights: "\u0644\u064a\u0644\u0629",
  billTo: "\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0639\u0645\u064a\u0644",
  description: "\u0627\u0644\u0648\u0635\u0641",
  roomType: "\u0646\u0648\u0639 \u0627\u0644\u063a\u0631\u0641\u0629",
  occupancy: "\u0627\u0644\u0625\u0634\u063a\u0627\u0644",
  quantity: "\u0627\u0644\u0643\u0645\u064a\u0629",
  perNight: "\u0633\u0639\u0631 \u0627\u0644\u0644\u064a\u0644\u0629",
  unitPrice: "\u0633\u0639\u0631 \u0627\u0644\u0648\u062d\u062f\u0629",
  total: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a",
  noLineItems: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u0646\u0648\u062f",
  subtotal: "\u0627\u0644\u0645\u062c\u0645\u0648\u0639 \u0627\u0644\u0641\u0631\u0639\u064a",
  discount: "\u0627\u0644\u062e\u0635\u0645",
  tax: "\u0627\u0644\u0636\u0631\u064a\u0628\u0629",
  vat: "\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629",
  serviceCharge: "رسوم الخدمة",
  nightsHeader: "الليالي",
  ratePerNight: "سعر الليلة",
  confirmationNo: "رقم التأكيد",
  paid: "\u0627\u0644\u0645\u062f\u0641\u0648\u0639",
  refunded: "\u0627\u0644\u0645\u0633\u062a\u0631\u062f",
  balanceDue: "\u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0645\u0633\u062a\u062d\u0642",
  date: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
  method: "\u0627\u0644\u0637\u0631\u064a\u0642\u0629",
  amount: "\u0627\u0644\u0645\u0628\u0644\u063a",
  payments: "\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a",
  notes: "\u0645\u0644\u0627\u062d\u0638\u0627\u062a",
  internal: "\u062f\u0627\u062e\u0644\u064a",
  thankYou: "\u0634\u0643\u0631\u064b\u0627 \u0644\u0625\u0642\u0627\u0645\u062a\u0643",
  taxId: "رقم التسجيل الضريبي",
  page: "\u0635\u0641\u062d\u0629",
  of: "\u0645\u0646",
}

const AR_INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "\u0645\u0633\u0648\u062f\u0629",
  issued: "\u0645\u0641\u062a\u0648\u062d\u0629",
  partially_paid: "\u0645\u062f\u0641\u0648\u0639\u0629 \u062c\u0632\u0626\u064a\u064b\u0627",
  partially_refunded: "\u0645\u0633\u062a\u0631\u062f\u0629 \u062c\u0632\u0626\u064a\u064b\u0627",
  paid: "\u0645\u062f\u0641\u0648\u0639\u0629",
  overdue: "\u0645\u062a\u0623\u062e\u0631\u0629",
  void: "\u0645\u0644\u063a\u0627\u0629",
  refunded: "\u0645\u0633\u062a\u0631\u062f\u0629",
}

const AR_INVOICE_ITEM_TYPE_LABELS: Record<string, string> = {
  room_charge: "\u0631\u0633\u0648\u0645 \u0627\u0644\u063a\u0631\u0641\u0629",
  extra_service: "\u062e\u062f\u0645\u0629 \u0625\u0636\u0627\u0641\u064a\u0629",
  minibar: "\u0645\u064a\u0646\u064a \u0628\u0627\u0631",
  laundry: "\u063a\u0633\u064a\u0644 \u0627\u0644\u0645\u0644\u0627\u0628\u0633",
  restaurant: "\u0627\u0644\u0645\u0637\u0639\u0645",
  late_checkout: "\u0645\u063a\u0627\u062f\u0631\u0629 \u0645\u062a\u0623\u062e\u0631\u0629",
  early_check_in: "\u0648\u0635\u0648\u0644 \u0645\u0628\u0643\u0631",
  damage_fee: "\u0631\u0633\u0648\u0645 \u0623\u0636\u0631\u0627\u0631",
  cleaning_fee: "\u0631\u0633\u0648\u0645 \u062a\u0646\u0638\u064a\u0641",
  parking: "\u0645\u0648\u0642\u0641 \u0633\u064a\u0627\u0631\u0627\u062a",
  transportation: "\u0646\u0642\u0644",
  discount: "\u062e\u0635\u0645",
  tax: "\u0636\u0631\u064a\u0628\u0629",
  service_charge: "\u0631\u0633\u0648\u0645 \u062e\u062f\u0645\u0629",
  manual_adjustment: "\u062a\u0633\u0648\u064a\u0629 \u064a\u062f\u0648\u064a\u0629",
  other: "\u0623\u062e\u0631\u0649",
}

const AR_PAYMENT_METHOD_LABELS: Record<string, string> = {
  instapay: "\u0625\u0646\u0633\u062a\u0627\u0628\u0627\u064a",
  vodafone_cash: "\u0641\u0648\u062f\u0627\u0641\u0648\u0646 \u0643\u0627\u0634",
  cash: "\u0646\u0642\u062f\u064a",
  bank_transfer: "\u062a\u062d\u0648\u064a\u0644 \u0628\u0646\u0643\u064a",
  visa: "\u0641\u064a\u0632\u0627",
}
export function getInvoicePdfLabels(locale: string) {
  return locale === "ar" ? AR_INVOICE_PDF_LABELS : EN_INVOICE_PDF_LABELS
}
export async function downloadInvoicePdf(invoice: InvoiceForPdf, locale: string): Promise<void> {
  const isRTL = locale === 'ar'
  const labels = getInvoicePdfLabels(locale)
  const formatInvoiceDate = (value: string | Date | null | undefined) =>
    isRTL ? formatPdfDate(value, locale) : formatDate(value, locale)
  const align = isRTL ? 'right' : 'left'
  const invNumber = invoiceNumberLabel(invoice.createdAt)
  // Printed in the invoice's own currency (amounts are never converted).
  const currency = invoice.currency
  const formatInvoiceCurrency = (value: number) => formatPdfCurrency(value, currency, locale)
  const statusLabel = isRTL
    ? AR_INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status
    : INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status
  const rawItems = invoice.items ?? []
  const payments = invoice.payments ?? []
  const pdfTotals = getInvoicePdfTotals(invoice)
  const reservation = await fetchReservationForPdf(invoice)
  const resRooms = reservation?.rooms ?? []
  const items = reservation ? matchItemsToRooms(rawItems, resRooms) : rawItems

  // ── Stay details ──
  const stayCheckIn = invoice.stayCheckIn ?? invoice.booking?.check_in ?? null
  const stayCheckOut = invoice.stayCheckOut ?? invoice.booking?.check_out ?? null
  const stayNights = computeNights(stayCheckIn, stayCheckOut)

  // ── Organization identity (Settings > Organization) ──
  const branding = await loadPdfBranding()
  const { logoDataUri } = branding
  const brandName = branding.name.toUpperCase()
  const contactLines = [...branding.contactLines, ...(branding.taxId ? [`${labels.taxId} ${branding.taxId}`] : [])]

  // ── Cell helper ──
  function cell(
    text: string,
    opts?: { bold?: boolean; alignment?: string; color?: string; fontSize?: number; margin?: [number, number, number, number] },
  ): Record<string, unknown> {
    return {
      text,
      bold: opts?.bold ?? false,
      alignment: opts?.alignment ?? align,
      color: opts?.color ?? C.text,
      fontSize: opts?.fontSize ?? 9,
      ...(opts?.margin ? { margin: opts.margin } : {}),
    }
  }

  // Header: mirror the brand and title blocks between LTR and RTL
  const brandAlignment = isRTL ? 'right' : 'left'
  const titleAlignment = isRTL ? 'left' : 'right'
  const brandDetails: Record<string, unknown> = {
    width: '*',
    stack: [
      { text: brandName, fontSize: 16, bold: true, color: C.green, letterSpacing: 1.5, alignment: brandAlignment },
      ...contactLines.map((line) => ({ text: line, fontSize: 8, color: C.textMuted, alignment: brandAlignment, margin: [0, 2, 0, 0] })),
    ],
  }
  const brandColumns: Record<string, unknown>[] = [brandDetails]
  if (logoDataUri) {
    const logo: Record<string, unknown> = {
      image: logoDataUri,
      width: 50,
      height: 50,
      alignment: brandAlignment,
      margin: isRTL ? [14, 0, 0, 0] : [0, 0, 14, 0],
    }
    if (isRTL) brandColumns.push(logo)
    else brandColumns.unshift(logo)
  }

  const brandBlock: Record<string, unknown> = {
    width: '58%',
    columns: brandColumns,
    alignment: brandAlignment,
  }
  const titleBlock: Record<string, unknown> = {
    width: '42%',
    stack: [
      { text: labels.taxInvoice, fontSize: 22, bold: true, color: C.green, alignment: titleAlignment },
      ...(branding.qr ? [{ ...pdfQrNode(branding.qr, titleAlignment, C.green), margin: [0, 6, 0, 0] }] : []),
    ],
  }

  const headerBlock = {
    columns: isRTL ? [titleBlock, brandBlock] : [brandBlock, titleBlock],
    columnGap: 16,
    margin: [0, 0, 0, 14],
  }
  // ── Invoice info grid ──
  const infoRows: string[][] = [
    [labels.invoiceNumber, invNumber, labels.status, statusLabel],
    [labels.issueDate, formatInvoiceDate(invoice.issueDate), labels.dueDate, formatInvoiceDate(invoice.dueDate)],
  ]
  if (invoice.roomNumber) infoRows.push([labels.room, invoice.roomNumber, '', ''])

  const infoTableBody = infoRows.map((r) => {
    const ordered = isRTL ? [...r].reverse() : r
    return ordered.map((t, i) => {
      const isLabel = isRTL ? i % 2 === 1 : i % 2 === 0
      const isLatinValue = !isLabel && /[A-Za-z0-9]/.test(t)
      return cell(t, {
        bold: isLabel,
        color: isLabel ? C.textMuted : C.text,
        fontSize: 9,
        margin: isRTL && isLatinValue ? [0, 3.5, 0, 0] : [0, 0, 0, 0],
      })
    })
  })

  const infoBlock = {
    table: { widths: isRTL ? ['*', 'auto', '*', 'auto'] : ['auto', '*', 'auto', '*'], body: infoTableBody },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: (i: number) => (i === 0 ? 0 : 4),
      paddingRight: (i: number) => (i === 3 ? 0 : 4),
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 0, 0, 8],
  }

  // ── Divider ──
  const divider = {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: C.border }],
    margin: [0, 0, 0, 8],
  }

  // ── Bill To (filter out empty / '-' / 'N/A' placeholders) ──
  function isReal(val: string | null | undefined): val is string {
    if (!val) return false
    const t = val.trim()
    return t.length > 0 && t !== '-' && t !== 'N/A' && t !== 'n/a' && t !== 'NA'
  }

  const contact = invoice.contact
  const contactName = isReal(contact?.name) ? contact!.name
    : isReal(invoice.companyName) ? invoice.companyName
    : isReal(invoice.guestName) ? invoice.guestName!
    : ''
  const billingAddr = isReal(invoice.billingAddress) ? invoice.billingAddress : ''
  const contactEmail = contact && isReal(contact.email) ? contact.email : ''
  const contactPhone = ''

  const billToLines: Record<string, unknown>[] = []
  if (contactName) billToLines.push({ text: contactName, fontSize: 10, bold: true, color: C.text, margin: [0, 0, 0, 2] })
  if (billingAddr) billToLines.push({ text: billingAddr, fontSize: 9, color: C.textMuted, margin: [0, 0, 0, 2] })
  if (contactEmail) billToLines.push({ text: contactEmail, fontSize: 9, color: C.textMuted, margin: [0, 0, 0, 1] })
  if (contactPhone) billToLines.push({ text: contactPhone, fontSize: 9, color: C.textMuted, margin: [0, 0, 0, 1] })

  const stayLines: Record<string, unknown>[] = []
  if (stayCheckIn && stayCheckOut) {
    stayLines.push(
      { text: labels.stay, fontSize: 8, bold: true, color: C.greenLight, margin: [0, 0, 0, 4] },
      { text: `${formatInvoiceDate(stayCheckIn)} — ${formatInvoiceDate(stayCheckOut)}`, fontSize: 9, bold: true, color: C.text },
      { text: `${stayNights ?? '-'} ${labels.nights}`, fontSize: 8, color: C.textMuted, margin: [0, 2, 0, 0] },
    )
  }
  if (reservation?.reservation_number) {
    stayLines.push({
      text: `${labels.confirmationNo} ${reservation.reservation_number}`,
      fontSize: 8,
      color: C.textMuted,
      margin: [0, 4, 0, 0],
    })
  }

  const billToBlock = billToLines.length > 0 || stayLines.length > 0
    ? {
        table: {
          widths: ['58%', '42%'],
          body: [[
            {
              stack: [
                { text: labels.billTo, fontSize: 8, bold: true, color: C.greenLight, margin: [0, 0, 0, 4] },
                ...billToLines,
              ],
            },
            { stack: stayLines },
          ]],
        },
        layout: {
          fillColor: () => C.warmBg,
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
        margin: [0, 0, 0, 8],
      }
    : null

  // ── Line items table ──
  const lineRows = buildInvoiceLineRows(items, {
    stayNights,
    stay: { checkIn: stayCheckIn, checkOut: stayCheckOut },
    formatDate: (d) => formatInvoiceDate(d),
    isRTL,
    itemLabel: (type) => (isRTL ? AR_INVOICE_ITEM_TYPE_LABELS[type] : INVOICE_ITEM_TYPE_LABELS[type]) ?? type,
  })
  const showNights = lineRows.some((r) => r.nights != null)
  const lineItemHeaderLabels = [
    '#',
    labels.description,
    labels.quantity,
    showNights ? labels.nightsHeader : '',
    showNights ? labels.ratePerNight : labels.unitPrice,
    labels.total,
  ]

  const lineItemHeaderRow = (isRTL ? [...lineItemHeaderLabels].reverse() : lineItemHeaderLabels).map((h) => ({
    text: h,
    fontSize: 8,
    color: C.white,
    bold: true,
    alignment: h === labels.description ? align : ('right' as const),
  }))

  const lineItemRows =
    lineRows.length === 0
      ? [
          [
            { text: labels.noLineItems, colSpan: 6, alignment: align, fontSize: 9, color: C.textMuted, margin: [0, 4, 0, 4] },
            {},
            {},
            {},
            {},
            {},
          ],
        ]
      : lineRows.map((r, i) => {
          const description = {
            stack: [
              { text: r.title, fontSize: 9, bold: true, color: C.text, alignment: align },
              ...r.details.map((d) => ({ text: d, fontSize: 8, color: C.textMuted, alignment: align, margin: [0, 2, 0, 0] })),
            ],
          }
          const row = [
            cell(String(i + 1), { alignment: 'right', color: C.textMuted }),
            description,
            cell(String(r.qty), { alignment: 'right' }),
            cell(r.nights != null ? String(r.nights) : '', { alignment: 'right' }),
            cell(formatInvoiceCurrency(r.unitPrice), { alignment: 'right' }),
            cell(formatInvoiceCurrency(r.total), { alignment: 'right', bold: true }),
          ]
          return isRTL ? row.reverse() : row
        })

  const lineItemsBlock = {
    unbreakable: true,
    table: {
      headerRows: 1,
      widths: isRTL
        ? ['17%', '17%', '9%', '8%', '44%', '5%']
        : ['5%', '44%', '8%', '9%', '17%', '17%'],
      body: [lineItemHeaderRow, ...lineItemRows],
    },
    layout: {
      fillColor: (rowIndex: number) => {
        if (rowIndex === 0) return C.green
        return rowIndex % 2 === 0 ? C.warmBg : C.white
      },
      hLineWidth: (rowIndex: number) => (rowIndex === 0 ? 0 : 0.5),
      hLineColor: () => C.border,
      vLineWidth: () => 0,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 0, 0, 8],
  }

  // ── Totals ──
  function totalRow(label: string, amount: string, opts?: { bold?: boolean; color?: string }) {
    return [
      cell(label, { bold: opts?.bold ?? false, color: opts?.color ?? C.text, alignment: isRTL ? align : 'right' }),
      cell(amount, { bold: opts?.bold ?? false, color: opts?.color ?? C.text, alignment: 'right' }),
    ]
  }

  const subRows = [
    totalRow(labels.subtotal, formatInvoiceCurrency(pdfTotals.subtotal)),
    ...(invoice.discount ? [totalRow(labels.discount, `-${formatInvoiceCurrency(invoice.discount)}`, { color: C.danger })] : []),
    ...(pdfTotals.tax ? [totalRow(percentLabel(rawItems, 'service_charge', labels.serviceCharge), formatInvoiceCurrency(pdfTotals.tax))] : []),
    ...(pdfTotals.vat ? [totalRow(percentLabel(rawItems, 'tax', labels.vat), formatInvoiceCurrency(pdfTotals.vat))] : []),
  ]

  const totalsBody = [
    ...subRows,
    // Final total with top border rendered as a distinct cell border
    [
      {
        ...cell(labels.total, { bold: true, color: C.green, fontSize: 11, alignment: isRTL ? align : 'right' }),
        border: [false, true, false, false],
      },
      {
        ...cell(formatInvoiceCurrency(invoice.amount), { bold: true, color: C.green, fontSize: 11, alignment: 'right' }),
        border: [false, true, false, false],
      },
    ],
  ]

  const totalsBlock = {
    unbreakable: true,
    table: {
      widths: ['70%', '30%'],
      body: totalsBody,
    },
    layout: {
      hLineWidth: (rowIndex: number, node: { table?: { body?: unknown[] } }) => {
        const last = (node.table?.body?.length ?? 0) - 1
        if (rowIndex === last) return 1.2 // thicker line above total
        if (rowIndex === 0) return 0
        return 0.5
      },
      hLineColor: (rowIndex: number, node: { table?: { body?: unknown[] } }) => {
        const last = (node.table?.body?.length ?? 0) - 1
        return rowIndex === last ? C.green : C.border
      },
      vLineWidth: () => 0,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 6],
    alignment: isRTL ? align : 'right',
  }

  // ── Paid / Balance summary ──
  const summaryRows: Record<string, unknown>[][] = []
  summaryRows.push([
    cell(labels.paid, { bold: true, color: C.success, alignment: 'right' }),
    cell(formatInvoiceCurrency(invoice.paidAmount), { bold: true, color: C.success, alignment: 'right' }),
  ])
  if (invoice.refundedAmount > 0) {
    summaryRows.push([
      cell(labels.refunded, { bold: true, color: C.warning, alignment: 'right' }),
      cell(formatInvoiceCurrency(invoice.refundedAmount), { bold: true, color: C.warning, alignment: 'right' }),
    ])
  }
  const balColor = invoice.remainingBalance > 0 ? C.green : C.textMuted
  summaryRows.push([
    cell(labels.balanceDue, { bold: true, color: balColor, alignment: 'right', fontSize: 11 }),
    cell(formatInvoiceCurrency(invoice.remainingBalance), { bold: true, color: balColor, alignment: 'right', fontSize: 11 }),
  ])

  const summaryBlock = {
    unbreakable: true,
    table: {
      widths: ['70%', '30%'],
      body: summaryRows,
    },
    layout: {
      hLineWidth: () => 0.5,
      hLineColor: () => C.border,
      vLineWidth: () => 0,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 8],
    alignment: 'right',
  }

  // ── Payments ──
  let paymentsBlock: Record<string, unknown> | null = null
  if (payments.length > 0) {
    const payHeader = [labels.date, labels.method, labels.description, labels.amount].map((h) => ({
      text: h,
      fontSize: 8,
      color: C.white,
      bold: true,
      alignment: h === labels.description ? align : ('right' as const),
    }))
    const payRows = payments.map((p) => [
      cell(formatInvoiceDate(p.createdAt), { alignment: 'right', color: C.textMuted }),
      cell(isRTL ? AR_PAYMENT_METHOD_LABELS[p.method] ?? p.method : PAYMENT_METHOD_LABELS[p.method] ?? p.method),
      cell(p.description ?? '-'),
      cell(formatInvoiceCurrency(Number(p.amount)), { alignment: 'right', bold: true }),
    ])
    paymentsBlock = {
      stack: [
        { text: labels.payments, fontSize: 10, bold: true, color: C.green, margin: [0, 0, 0, 6] },
        {
          unbreakable: true,
          table: {
            headerRows: 1,
            widths: ['18%', '20%', '42%', '20%'],
            body: [payHeader, ...payRows],
          },
          layout: {
            fillColor: (rowIndex: number) => {
              if (rowIndex === 0) return C.green
              return rowIndex % 2 === 0 ? C.warmBg : C.white
            },
            hLineWidth: (rowIndex: number) => (rowIndex === 0 ? 0 : 0.5),
            hLineColor: () => C.border,
            vLineWidth: () => 0,
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 5,
            paddingBottom: () => 5,
          },
        },
      ],
      margin: [0, 0, 0, 8],
    }
  }

  // ── Notes ──
  const notes: string[] = []
  if (invoice.publicNotes) notes.push(invoice.publicNotes)
  if (invoice.internalNotes) notes.push(`[${labels.internal}] ${invoice.internalNotes}`)

  let notesBlock: Record<string, unknown> | null = null
  if (notes.length > 0) {
    notesBlock = {
      stack: [
        { text: labels.notes, fontSize: 10, bold: true, color: C.green, margin: [0, 0, 0, 4] },
        ...notes.map((n) => ({ text: n, fontSize: 9, color: C.textMuted, margin: [0, 0, 0, 2] })),
      ],
      margin: [0, 0, 0, 0],
    }
  }

  // ── Assemble content array ──
  const content: Record<string, unknown>[] = []
  content.push(
    headerBlock,
    infoBlock,
    divider,
  )
  if (billToBlock) content.push(billToBlock)
  content.push(lineItemsBlock)
  if (subRows.length > 0) content.push(totalsBlock)
  content.push(summaryBlock)
  if (paymentsBlock) content.push(paymentsBlock)
  if (notesBlock) content.push(notesBlock)

  // ── Footer ──
  const footerParts = [`${labels.invoice} ${invNumber}`]
  if (contactName) footerParts.push(contactName)
  if (stayNights) footerParts.push(`${stayNights} ${labels.nights}`)
  footerParts.push(branding.footer || labels.thankYou)
  const footerText = footerParts.join(' | ')

  // ── Assemble doc definition ──
  let pdfMake: Awaited<ReturnType<typeof getPdfMake>>
  try {
    // Arabic guest/contact data can appear even in LTR invoices, so always load the font.
    pdfMake = await getPdfMake(true)
  } catch (err) {
    console.error('[invoicePdfExport] getPdfMake FAILED', err)
    const { toast } = await import('@/shared/toast/toastEvents')
    toast.error('Failed to generate invoice PDF')
    throw err
  }

  const docDef: Record<string, unknown> = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [25, 44, 25, 64],
    defaultStyle: { font: 'Arial', fontSize: 9, color: C.text },
    footer: (currentPage: number, pageCount: number) => applyPdfFonts({
      columns: [
        {
          width: '*',
          alignment: 'center',
          stack: [
            {
              canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: C.border }],
              margin: [0, 0, 0, 6],
            },
            {
              text: footerText,
              fontSize: 8,
              color: C.textMuted,
              alignment: 'center',
            },
            {
              text: `${labels.page} ${currentPage} ${labels.of} ${pageCount}`,
              fontSize: 7,
              color: C.textMuted,
              alignment: 'center',
              margin: [0, 2, 0, 0],
            },
          ],
        },
      ],
      margin: [25, 0, 25, 0],
    }, locale),
    styles: {
      hotelName: { fontSize: 14, bold: true, color: C.green },
      hotelSub: { fontSize: 8, color: C.textMuted },
      invoiceTitle: { fontSize: 28, bold: true, color: C.green },
      sectionLabel: { fontSize: 10, bold: true, color: C.green },
      tableHeader: { fontSize: 9, color: C.white, bold: true },
      bodyText: { fontSize: 9, color: C.text },
    },
    content,
  }

  try {
    const finalDef = isRTL ? buildArabicDocDef(docDef) : applyPdfFonts(docDef, locale)
    const pdfInstance = pdfMake.createPdf(finalDef)

    if (isRTL) {
      const buffer = await pdfInstance.getBuffer()
      const rtlBuffer = injectRTLOptions(buffer)
      downloadBuffer(rtlBuffer, `${invNumber}.pdf`)
    } else {
      pdfInstance.download(`${invNumber}.pdf`)
    }
  } catch (err) {
    console.error('[invoicePdfExport] downloadInvoicePdf FAILED', err)
    try {
      const { toast } = await import('@/shared/toast/toastEvents')
      toast.error('Failed to generate invoice PDF')
    } catch { /* toast unavailable */ }
    throw err
  }
}

export async function printInvoicePdf(invoice: InvoiceForPdf, locale: string): Promise<void> {
  await downloadInvoicePdf(invoice, locale)
}
