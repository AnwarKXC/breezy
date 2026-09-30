'use client'

import { useLocale } from '@/i18n/components/LocaleContext'
import { countryName } from '@/shared/static/countries'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { memo, useCallback, useMemo, useState } from 'react'
import { useContactForm } from '@/modules/contacts/hooks/useContactForm'
import { ContactForm } from '@/modules/contacts/components/ContactForm'
import { getContactErrorDescription } from '@/modules/contacts/utils/contactErrors'
import { useTranslation } from '@/i18n/hooks/useTranslation'

import { Card } from '@/shared/components/Card'
import { AnalyticsCard } from '@/shared/components/AnalyticsCard'
import type { CompanyPriceOverride, CreatePriceOverrideInput } from '@/modules/contacts/types'
import { PriceOverridesSection } from '@/modules/contacts/components/PriceOverridesSection'
import { deleteContact as deleteContactApi, upsertPriceOverridesApi } from '@/modules/contacts/services/contactsApiClient'
import type { Contact } from '@/modules/contacts/types'
import { InvoicesSection } from '@/modules/contacts/components/InvoicesSection'
import { BookingsSection } from '@/modules/contacts/components/BookingsSection'
import type { Invoice } from '@/modules/contacts/types/invoiceTypes'
import type { Booking } from '@/modules/bookings/types'
import { ContactTypeBadge } from '@/modules/contacts/components/ContactTypeBadge'
import type { Locale } from '@/i18n/config'
import { buildBookingsCsv } from '@/modules/bookings/utils/bookingCsvExport'
import { exportBookingsPdf } from '@/modules/bookings/utils/bookingPdfExport'
import { buildInvoicesCsv } from '@/modules/contacts/utils/invoiceCsvExport'
import { exportInvoicesPdf } from '@/modules/contacts/utils/invoicePdfExport'
import { DeleteConfirmationDialog } from '@/shared/components/DeleteConfirmationDialog'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { ViewInCurrencyToggle } from '@/shared/components/ViewInCurrencyToggle'
import { useCan } from '@/shared/rbac/useCan'
import { ACTIONS } from '@/config/rbac'

interface ContactDetailsViewProps {
  contact: Contact | null
  locale: Locale
  labels: Record<string, string>
  permissions: {
    canCreateContacts: boolean
    canDeleteContacts: boolean
    canUpdateContacts: boolean
    canUpdatePriceOverrides: boolean
  }
  priceOverrides?: CompanyPriceOverride[]
  roomTypes?: { slug: string; name: string; basePrice: number }[]
  invoices?: Invoice[]
  bookings?: Booking[]
  seasonalPrices?: Record<string, { price: number; priceSingle: number | null; priceDouble: number | null; priceTriple: number | null }>
  filterYear?: number
  filterMonth?: number
}

function HeroSection({ contact, labels, permissions, onDelete, onEdit }: { contact: Contact; labels: Record<string, string>; permissions: ContactDetailsViewProps['permissions']; onDelete?: () => void; onEdit?: () => void }) {
  const locale = useLocale()
  const isCompany = contact.type === 'company'

  return (
    <Card padding="lg">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          {contact.logo ? (
            <Image unoptimized
              src={contact.logo}
              alt=""
              width={72}
              height={72}
              className="h-18 w-18 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="grid h-18 w-18 shrink-0 place-items-center rounded-xl bg-[#F5F5F5] text-2xl font-bold text-[#333333]">
              {contact.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">{contact.name}</h1>
              <ContactTypeBadge type={contact.type} labels={labels} />
            </div>
            <p className="mt-1 text-sm text-[#787774]">
              {isCompany ? contact.responsiblePerson || labels.responsiblePerson : contact.email || contact.phone}
            </p>
            <p className="mt-1 text-xs text-[#787774]">
              {labels.createdLabel}: {new Date(contact.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {permissions.canUpdateContacts && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl bg-[#F5F5F5] px-4 py-2 text-sm font-bold text-[#555555] transition-all duration-200 hover:bg-[#EAEAEA]"
            >
              {labels.edit}
            </button>
          )}
          {permissions.canDeleteContacts && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl bg-[#FDEBEC] px-4 py-2 text-sm font-bold text-[#9F2F2D] transition-all duration-200 hover:bg-[#FDEBEC]"
            >
              {labels.delete}
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.phone}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm font-medium text-[#1A1A1A]">{contact.phone}</p>
            {contact.phone ? (
              <div className="flex gap-1">
                <a
                  href={`https://wa.me/${contact.phone.replace(/[^\d+]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-600 transition-colors hover:bg-green-100"
                  aria-label={labels.whatsapp}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
                <a
                  href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#1A1A1A] transition-colors hover:bg-blue-100"
                  aria-label={labels.call}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </a>
              </div>
            ) : null}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.email}</p>
          <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{contact.email || '—'}</p>
        </div>
        {isCompany && (
          <>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.country}</p>
              <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{contact.country ? countryName(contact.country, locale) : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.city}</p>
              <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{contact.city || '—'}</p>
            </div>
          </>
        )}
        {!isCompany && contact.idPassport && (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.idPassport}</p>
            <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{contact.idPassport}</p>
          </div>
        )}
      </div>
    </Card>
  )
}

function ContactAnalytics({ invoices }: { invoices: Invoice[] }) {
  const { t } = useTranslation()
  const { formatTotals } = useCurrency()
  // A contact can be invoiced in several currencies: totals stay per currency.
  const totalRevenue = invoices.filter((i) => i.status === 'paid').map((i) => ({ amount: Number(i.amount), currency: i.currency }))
  const remaining = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue').map((i) => ({ amount: Number(i.amount), currency: i.currency }))
  const lastInvoice = invoices.length ? invoices.reduce((latest, i) => i.issueDate > latest.issueDate ? i : latest) : null

  return (
    <div className="space-y-3">
    <ViewInCurrencyToggle className="justify-end" />
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AnalyticsCard label={t('accounting.invoices.summary.totalInvoices')} value={invoices.length} accent="indigo" />
      <AnalyticsCard label={t('accounting.invoices.amount')} value={formatTotals(totalRevenue)} accent="emerald" />
      <AnalyticsCard label={t('accounting.finance.outstanding')} value={formatTotals(remaining)} accent="amber" />
      <AnalyticsCard label={t('accounting.invoices.invoice')} value={lastInvoice ? `#${lastInvoice.invoiceNumber}` : '—'} accent="violet" />
    </section>
    </div>
  )
}

export const ContactDetailsView = memo(function ContactDetailsViewComponent({
  contact: initialContact,
  locale,
  labels,
  permissions,
  priceOverrides = [],
  roomTypes = [],
  invoices = [],
  bookings = [],
  seasonalPrices,
  filterYear,
  filterMonth,
}: ContactDetailsViewProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const [contact, setContact] = useState(initialContact)
  const [localPriceOverrides, setLocalPriceOverrides] = useState(priceOverrides)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deletingContact, setDeletingContact] = useState(false)
  const [bookingsList, setBookingsList] = useState(bookings)
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(filterYear)
  const [selectedMonth, setSelectedMonth] = useState(filterMonth)
  const canCreateReservation = useCan(ACTIONS.RESERVATIONS_CREATE)

  const handleBookRoom = useCallback(() => {
    if (!contact) return
    const params = new URLSearchParams({ contactId: contact.id, name: contact.name })
    router.push(`/${locale}/reservations/new?${params.toString()}`)
  }, [contact, locale, router])

  const handleFilterChange = useCallback(async (year?: number, month?: number) => {
    setSelectedYear(year)
    setSelectedMonth(month)
    setBookingsLoading(true)
    try {
      const params = new URLSearchParams({ contactId: contact?.id ?? '' })
      if (contact?.type) params.set('contactType', contact.type)
      if (year) params.set('year', String(year))
      if (month) params.set('month', String(month))
      const res = await fetch(`/api/contacts/bookings?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        const data = (json.data ?? []).map((b: Record<string, unknown>) => ({
          ...b,
          checkIn: new Date(b.checkIn as string),
          checkOut: new Date(b.checkOut as string),
          createdAt: new Date(b.createdAt as string),
          updatedAt: new Date(b.updatedAt as string),
        }))
        setBookingsList(data)
      }
    } finally {
      setBookingsLoading(false)
    }
  }, [contact?.id, contact?.type])

  const mergedLabels: Record<string, string> = useMemo(() => ({
    ...labels,
    edit: t('common.edit'),
    delete: t('common.delete'),
    close: t('common.close'),
    cancel: t('common.cancel'),
    confirmDeleteTitle: t('common.confirmDeleteTitle'),
    confirmDeleteDescription: t('common.confirmDeleteDescription'),
    confirmDeleteAction: t('common.confirmDeleteAction'),
    whatsapp: t('contacts.whatsapp'),
    call: t('contacts.call'),
    currency: t('settings.currency.label'),
  }), [labels, t])

  const form = useContactForm({
    triggerMutation: useCallback((savedDraft) => {
      if (savedDraft) {
        setContact((prev) => prev ? { ...prev, name: savedDraft.name, phone: savedDraft.phone, email: savedDraft.email ?? '', logo: savedDraft.logo ?? '', country: savedDraft.country ?? '', city: savedDraft.city ?? '', responsiblePerson: savedDraft.responsiblePerson ?? '', idPassport: savedDraft.idPassport ?? '' } : prev)
      }
      router.refresh()
    }, [router]),
  })

  const formLabels = {
    createTitle: t('contacts.form.createTitle'),
    editTitle: t('contacts.form.editTitle'),
    description: t('contacts.form.description'),
    saving: t('contacts.form.saving'),
    close: t('common.close'),
    cancel: t('common.cancel'),
    save: t('common.save'),
    type: t('contacts.type'),
    name: t('contacts.name'),
    phone: t('contacts.phone'),
    email: t('contacts.email'),
    company: t('contacts.company'),
    individual: t('contacts.individual'),
    country: t('contacts.country'),
    city: t('contacts.city'),
    responsiblePerson: t('contacts.responsiblePerson'),
    idPassport: t('contacts.idPassport'),
    logo: t('contacts.logo'),
  }

  const formErrorDescription = getContactErrorDescription(form.error, labels)
  const phoneErrorDescription = getContactErrorDescription(form.phoneError, labels)

  const bookingExportLabels = useMemo(() => ({
    guestName: labels.guestName ?? t('contacts.guestName'),
    roomNumber: labels.roomNumber ?? t('contacts.roomNumber'),
    checkIn: labels.checkIn ?? t('contacts.checkIn'),
    checkOut: labels.checkOut ?? t('contacts.checkOut'),
    status: labels.status ?? t('contacts.status'),
    totalAmount: labels.totalAmount ?? t('contacts.totalAmount'),
    paidAmount: labels.paidAmount ?? t('contacts.paidAmount'),
    title: labels.bookingsTitle ?? t('contacts.bookingsTitle'),
  }), [labels, t])

  const invoiceExportLabels = useMemo(() => ({
    invoiceNumber: labels.invoiceNumber ?? t('contacts.invoiceNumber'),
    amount: labels.amount ?? t('contacts.amount'),
    status: labels.status ?? t('contacts.status'),
    issueDate: labels.issueDate ?? t('contacts.issueDate'),
    dueDate: labels.dueDate ?? t('contacts.dueDate'),
    paidAt: labels.paidAt ?? t('contacts.paidAt'),
    notes: labels.notes ?? t('contacts.notes'),
    title: labels.invoicesTitle ?? t('contacts.invoicesTitle'),
  }), [labels, t])

  const handleSaveOverrides = useCallback(
    async (overrides: CreatePriceOverrideInput[]) => {
      if (!contact) return
      const saved = await upsertPriceOverridesApi(contact.id, overrides)
      setLocalPriceOverrides((prev) => {
        const map = new Map(prev.map((o) => [`${o.roomCategory}:${o.occupancyCode}`, o]))
        for (const item of saved) {
          map.set(`${item.roomCategory}:${item.occupancyCode}`, item)
        }
        return Array.from(map.values())
      })
    },
    [contact],
  )

  const fileStamp = useCallback(() => new Date().toISOString().slice(0, 10), [])

  const handleBookingsExportCsv = useCallback(() => {
    const csv = buildBookingsCsv(bookings, bookingExportLabels)
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bookings-${fileStamp()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [bookings, bookingExportLabels, fileStamp])

  const handleBookingsExportPdf = useCallback(() => {
    void exportBookingsPdf(bookings, bookingExportLabels, locale, `bookings-${fileStamp()}.pdf`)
  }, [bookings, bookingExportLabels, locale, fileStamp])

  const handleInvoicesExportCsv = useCallback(() => {
    const csv = buildInvoicesCsv(invoices, invoiceExportLabels)
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `invoices-${fileStamp()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [invoices, invoiceExportLabels, fileStamp])

  const handleInvoicesExportPdf = useCallback(() => {
    void exportInvoicesPdf(invoices, invoiceExportLabels, locale, `invoices-${fileStamp()}.pdf`)
  }, [invoices, invoiceExportLabels, locale, fileStamp])

  const handleDeleteContact = useCallback(() => {
    if (!contact || deletingContact) return
    setDeletingContact(true)
    void deleteContactApi(contact.id).then(() => {
      setConfirmDeleteOpen(false)
      router.push(`/${locale}/contacts`)
      router.refresh()
    }).finally(() => setDeletingContact(false))
  }, [contact, locale, router, deletingContact])

  return (
    <main>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EAEAEA] bg-white text-[#555555] transition-colors hover:bg-[#F9F9F8]"
            aria-label={labels.detailsBack}
          >
            ?
          </button>
          <nav className="flex items-center gap-2 text-sm">
            <Link href={`/${locale}/contacts`} className="text-[#787774] transition-colors hover:text-[#555555]">
              {t('nav.contacts')}
            </Link>
            <span className="text-[#BBBBBB]">/</span>
            <span className="font-medium text-[#1A1A1A]">{contact?.name}</span>
          </nav>
        </div>

        {contact ? (
          <>
            <HeroSection
              contact={contact}
              labels={mergedLabels}
              permissions={permissions}
              onDelete={() => setConfirmDeleteOpen(true)}
              onEdit={() => form.openEditForm(contact)}
            />
            <ContactAnalytics invoices={invoices} />
            {contact.type === 'company' && (
              <PriceOverridesSection
                overrides={localPriceOverrides}
                roomTypes={roomTypes ?? []}
                canEdit={permissions.canUpdatePriceOverrides}
                onSave={handleSaveOverrides}
                labels={mergedLabels}
                seasonalPrices={seasonalPrices}
              />
            )}
            <BookingsSection
              bookings={bookingsList}
              labels={mergedLabels}
              onExportCsv={handleBookingsExportCsv}
              onExportPdf={handleBookingsExportPdf}
              onBook={canCreateReservation ? handleBookRoom : undefined}
              filterYear={selectedYear}
              filterMonth={selectedMonth}
              onFilterChange={handleFilterChange}
              loading={bookingsLoading}
            />
            <InvoicesSection
              invoices={invoices}
              labels={mergedLabels}
              onExportCsv={handleInvoicesExportCsv}
              onExportPdf={handleInvoicesExportPdf}
            />
          </>
        ) : (
          <Card padding="lg">
            <p className="text-sm text-[#787774]">{mergedLabels.notFound}</p>
          </Card>
        )}
      </div>
      {form.open && form.mode === 'edit' && permissions.canUpdateContacts ? (
        <ContactForm
          draft={form.draft}
          error={form.error}
          errorDescription={formErrorDescription}
          fieldErrors={form.fieldErrors}
          phoneError={form.phoneError}
          phoneErrorDescription={phoneErrorDescription}
          labels={formLabels}
          mode={form.mode}
          saving={form.saving}
          onClose={form.closeForm}
          onSubmit={form.submitForm}
          onUpdate={form.updateDraft}
        />
      ) : null}
      <DeleteConfirmationDialog
        isOpen={confirmDeleteOpen}
        title={mergedLabels.confirmDeleteTitle}
        description={mergedLabels.confirmDeleteDescription}
        cancelLabel={mergedLabels.cancel}
        confirmLabel={mergedLabels.confirmDeleteAction}
        loading={deletingContact}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteContact}
      />
    </main>
  )
})
