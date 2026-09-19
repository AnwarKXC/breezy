import type { Locale } from '@/i18n/config'
import { buildAndDownloadPdf } from '@/shared/utils/pdfMake'
import { formatDateTime } from '@/shared/utils/date'
import type { Contact } from '../types'
import { countryName } from '@/shared/static/countries'

type ExportLabels = Record<
  'name' | 'type' | 'phone' | 'email' | 'country' | 'city' | 'responsiblePerson' | 'idPassport' | 'createdAt' | 'title',
  string
>

export async function exportContactsPdf(
  contacts: Contact[],
  labels: ExportLabels,
  locale: Locale,
  fileName: string,
): Promise<void> {
  const rows = contacts.map((contact) => [
    contact.name,
    contact.type,
    contact.phone ?? '',
    contact.email ?? '',
    contact.country ? countryName(contact.country, locale) : '',
    contact.city ?? '',
    contact.responsiblePerson ?? '',
    contact.idPassport ?? '',
    formatDateTime(contact.createdAt, locale),
  ])

  await buildAndDownloadPdf({
    title: labels.title,
    headers: [
      labels.name, labels.type, labels.phone, labels.email,
      labels.country, labels.city, labels.responsiblePerson, labels.idPassport, labels.createdAt,
    ],
    rows,
    // A4 landscape printable width (745.89pt) minus 16pt horizontal
    // padding per cell. Explicit widths prevent long values from expanding
    // the nine-column table beyond the page.
    columnWidths: [80, 48, 65, 90, 50, 55, 75, 65, 73],
    locale,
    fileName,
  })
}
