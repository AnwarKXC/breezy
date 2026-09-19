import { ContactDetailsView } from './ContactDetailsView'
import { getContactById } from '@/modules/contacts/services/contactService'
import { getPriceOverrides } from '@/modules/contacts/services/priceOverrideService'
import { getInvoicesByContact } from '@/modules/contacts/services/invoiceService'
import { getBookingsByContact } from '@/modules/bookings/services/bookingService'
import { listRoomTypes } from '@/modules/room-types/services/roomTypeService'
import {
  getContactsUiPermissions,
  requireContactsRead,
} from '@/modules/contacts/services/serviceSecurity'
import { prisma } from '@/services/db/prisma'
import type { CompanyPriceOverride } from '@/modules/contacts/types'
import type { Invoice } from '@/modules/contacts/types/invoiceTypes'
import type { Booking } from '@/modules/bookings/types'
import { checkLocale } from '@/i18n/config'
import ar from '@/i18n/locales/ar.json'
import en from '@/i18n/locales/en.json'

const translations = { ar, en }

function ContactDetailsErrorState({ error, label }: { error: string; label: string }) {
  return (
    <main className="min-h-screen bg-[#F4F5F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-xl bg-white p-10 text-center ">
        <h1 className="text-base font-medium text-[#1A1A1A]">{label}</h1>
        <p className="mt-2 text-sm text-[#787774]">{error}</p>
      </div>
    </main>
  )
}

function ContactNotFound({ labels }: { labels: Record<string, string> }) {
  return (
    <main className="min-h-screen bg-[#F4F5F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-xl bg-white p-10 text-center ">
        <h1 className="text-base font-medium text-[#1A1A1A]">{labels.notFound}</h1>
      </div>
    </main>
  )
}

export default async function ContactDetailsRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const { locale: rawLocale, id } = await params
  const { year, month } = await searchParams
  const locale = checkLocale(rawLocale)
  const labels = translations[locale].contacts as unknown as Record<string, string>
  let contact = null
  let overrides: CompanyPriceOverride[] = []
  let invoices: Invoice[] = []
  let bookings: Booking[] = []
  let roomTypes: { slug: string; name: string; basePrice: number }[] = []
  let seasonalPrices: Record<string, { price: number; priceSingle: number | null; priceDouble: number | null; priceTriple: number | null }> = {}
  let errorMessage: string | null = null
  let permissions = { canCreateContacts: false, canDeleteContacts: false, canUpdateContacts: false, canUpdatePriceOverrides: false }

  try {
    const session = await requireContactsRead()
    permissions = getContactsUiPermissions(session)
    contact = await getContactById(id)
    overrides = await getPriceOverrides(id)
    invoices = await getInvoicesByContact(id)
    bookings = await getBookingsByContact(id, contact?.type, {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    }).catch(() => [] as Booking[])
    roomTypes = (await listRoomTypes()).map(rt => ({ slug: rt.slug, name: rt.name, basePrice: rt.basePrice }))

    const pricingRows = await prisma.room_type_pricing.findMany({
      where: { deleted_at: null },
      include: { room_types: { select: { slug: true } } },
    })
    {
      const now = new Date()
      for (const row of pricingRows) {
        const slug = row.room_types?.slug
        if (!slug) continue
        if (row.effective_from && row.effective_from > now) continue
        if (row.effective_until && row.effective_until < now) continue
        if (!seasonalPrices[slug]) {
          seasonalPrices[slug] = {
            price: Number(row.price),
            priceSingle: row.price_single != null ? Number(row.price_single) : null,
            priceDouble: row.price_double != null ? Number(row.price_double) : null,
            priceTriple: row.price_triple != null ? Number(row.price_triple) : null,
          }
        }
      }
    }
  } catch (error) {
    errorMessage = (error as Error).message
  }

  if (errorMessage) {
    return <ContactDetailsErrorState error={errorMessage} label={labels.errorTitle} />
  }

  if (!contact) {
    return <ContactNotFound labels={labels} />
  }

  return (
      <ContactDetailsView
        key={`${year ?? ''}-${month ?? ''}`}
        contact={contact}
        locale={locale}
        labels={labels}
        permissions={permissions}
        priceOverrides={overrides}
        roomTypes={roomTypes}
        invoices={invoices}
        bookings={bookings}
        seasonalPrices={seasonalPrices}
        filterYear={year ? Number(year) : undefined}
        filterMonth={month ? Number(month) : undefined}
      />
  )
}
