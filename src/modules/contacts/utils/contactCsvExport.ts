import type { Contact } from '../types'

interface ExportLabels {
  name: string
  type: string
  phone: string
  email: string
  country: string
  city: string
  responsiblePerson: string
  idPassport: string
  createdAt: string
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function buildContactsCsv(
  contacts: Contact[],
  labels: ExportLabels,
) {
  const header = [
    labels.name,
    labels.type,
    labels.phone,
    labels.email,
    labels.country,
    labels.city,
    labels.responsiblePerson,
    labels.idPassport,
    labels.createdAt,
  ]
  const rows = contacts.map((contact) => [
    contact.name,
    contact.type,
    contact.phone ?? '',
    contact.email ?? '',
    contact.country ?? '',
    contact.city ?? '',
    contact.responsiblePerson ?? '',
    contact.idPassport ?? '',
    formatDate(contact.createdAt),
  ])

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n')
}
