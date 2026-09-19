import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import type { contact_type } from '@/generated/prisma/enums'
import { prisma } from '@/services/db/prisma'
import { toRow, toRows } from '@/services/db/rows'
import type { LogDocument } from '@/types/logs'
import { decodeCursor, encodeCursor, getPageLimit } from '@/shared/pagination/cursor'
import type { Contact, ContactsListParams, ContactsMetrics, ContactsPage, ContactType, CreateContactInput, UpdateContactInput } from '../types'
import { requireContactsCreate, requireContactsDelete, requireContactsRead, requireContactsUpdate } from './serviceSecurity'
import { logContactCreated, logContactDeleted, logContactUpdated } from './activityLogService'
import { mapLogRow } from '@/services/logs/logRows'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

function pageLimit(limit?: number) {
  return getPageLimit(limit, DEFAULT_LIMIT, MAX_LIMIT)
}

export type ContactRow = {
  id: string
  type: string
  name: string
  phone: string | null
  email: string | null
  logo: string | null
  country: string | null
  city: string | null
  responsible_person: string | null
  id_passport: string | null
  created_at: string
  updated_at: string
}

export function mapContactRow(row: ContactRow): Contact {
  return {
    id: row.id,
    type: row.type as ContactType,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    logo: row.logo ?? undefined,
    country: row.country ?? undefined,
    city: row.city ?? undefined,
    responsiblePerson: row.responsible_person ?? undefined,
    idPassport: row.id_passport ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function hasType(input: CreateContactInput | UpdateContactInput): input is CreateContactInput {
  return 'type' in input
}

export function toContactRow(input: CreateContactInput | UpdateContactInput) {
  return {
    ...(hasType(input) && { type: input.type }),
    ...('name' in input && input.name !== undefined && { name: input.name }),
    ...('phone' in input && input.phone !== undefined && { phone: input.phone || null }),
    ...(input.email !== undefined && { email: input.email || null }),
    ...('logo' in input && { logo: input.logo || null }),
    ...(input.country !== undefined && { country: input.country || null }),
    ...(input.city !== undefined && { city: input.city || null }),
    ...(input.responsiblePerson !== undefined && { responsible_person: input.responsiblePerson || null }),
    ...(input.idPassport !== undefined && { id_passport: input.idPassport || null }),
  }
}

const CONTACT_SELECT = {
  id: true,
  type: true,
  name: true,
  phone: true,
  email: true,
  logo: true,
  country: true,
  city: true,
  responsible_person: true,
  id_passport: true,
  created_at: true,
  updated_at: true,
} as const

const toContact = (row: unknown) => mapContactRow(toRow('contacts', row) as unknown as ContactRow)

async function checkPhoneExists(phone: string, excludeId?: string): Promise<boolean> {
  const count = await prisma.contacts.count({
    where: { phone, deleted_at: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
  })
  return count > 0
}

export async function getContactsPage(params: ContactsListParams = {}): Promise<ContactsPage> {
  await requireContactsRead()
  const limit = pageLimit(params.limit)
  const search = params.search?.trim()

  const where: Prisma.contactsWhereInput = { deleted_at: null }
  if (params.type && params.type !== 'all') where.type = params.type as contact_type
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  let cursorWhere: Prisma.contactsWhereInput | undefined
  if (params.cursor) {
    const cursor = decodeCursor(params.cursor)
    const value = String(cursor.value)
    cursorWhere = search
      ? { OR: [{ name: { gt: value } }, { name: value, id: { gt: cursor.id } }] }
      : { OR: [{ created_at: { lt: new Date(value) } }, { created_at: new Date(value), id: { lt: cursor.id } }] }
  }

  const [rows, total] = await Promise.all([
    prisma.contacts.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      select: CONTACT_SELECT,
      orderBy: search ? [{ name: 'asc' }, { id: 'asc' }] : [{ created_at: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    }),
    prisma.contacts.count({ where }),
  ])

  const contacts = rows.slice(0, limit).map(toContact)
  const last = contacts.at(-1)
  const hasMore = rows.length > limit

  return {
    data: contacts,
    hasMore,
    total,
    nextCursor: hasMore && last
      ? encodeCursor({
          id: last.id,
          value: search ? last.name : last.createdAt,
        })
      : null,
  }
}

export async function getContactById(id: string): Promise<Contact | null> {
  await requireContactsRead()
  const row = await prisma.contacts.findFirst({ where: { id, deleted_at: null }, select: CONTACT_SELECT })
  return row ? toContact(row) : null
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  await requireContactsCreate()
  if (input.phone && await checkPhoneExists(input.phone)) {
    throw new Error('contacts/phone_exists')
  }
  const row = await prisma.contacts.create({
    data: toContactRow(input) as Prisma.contactsCreateInput,
    select: CONTACT_SELECT,
  })
  const created = toContact(row)
  void logContactCreated({ id: created.id, name: created.name, type: created.type }).catch(() => undefined)
  return created
}

export async function updateContact(id: string, input: UpdateContactInput): Promise<Contact> {
  await requireContactsUpdate()
  if (input.phone && (await checkPhoneExists(input.phone, id))) {
    throw new Error('contacts/phone_exists')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const oldContact = await tx.contacts.findFirst({ where: { id, deleted_at: null }, select: { name: true } })
    const row = await tx.contacts.update({
      where: { id },
      data: toContactRow(input) as Prisma.contactsUpdateInput,
      select: CONTACT_SELECT,
    })

    // Propagate a name change to related reservations and invoices. Company
    // contacts are linked via reservations.company_id, individuals via
    // reservation_guests.contact_id.
    if (input.name && oldContact && input.name !== oldContact.name) {
      const newName = input.name
      const guestLinks = await tx.reservation_guests.findMany({ where: { contact_id: id }, select: { reservation_id: true } })
      const linkedReservationIds = [...new Set(guestLinks.map((g) => g.reservation_id))]

      await tx.reservations.updateMany({
        where: { deleted_at: null, OR: [{ company_id: id }, { id: { in: linkedReservationIds } }] },
        data: { booker_name: newName },
      })
      await tx.reservation_guests.updateMany({ where: { contact_id: id, deleted_at: null }, data: { full_name: newName } })
      await tx.reservation_company_info.updateMany({ where: { company_id: id }, data: { company_name: newName } })
      await tx.invoices.updateMany({ where: { contact_id: id, deleted_at: null }, data: { guest_name: newName } })
    }
    return row
  })

  const contact = toContact(updated)
  void logContactUpdated({ id: contact.id, name: contact.name, type: contact.type }).catch(() => undefined)
  return contact
}

export async function deleteContact(id: string): Promise<void> {
  await requireContactsDelete()
  const deletedAt = new Date()
  const contact = await prisma.$transaction(async (tx) => {
    const existing = await tx.contacts.findFirst({ where: { id, deleted_at: null }, select: { id: true, name: true, type: true } })
    if (!existing) throw new Error('contacts/not_found')
    await tx.contacts.update({ where: { id }, data: { deleted_at: deletedAt } })
    await tx.company_price_overrides.updateMany({ where: { contact_id: id, deleted_at: null }, data: { deleted_at: deletedAt } })
    await tx.invoices.updateMany({ where: { contact_id: id, deleted_at: null }, data: { deleted_at: deletedAt } })
    return existing
  })
  void logContactDeleted({ id: contact.id, name: contact.name, type: contact.type as ContactType }).catch(() => undefined)
}

export async function getContactsMetrics(): Promise<ContactsMetrics> {
  await requireContactsRead()
  const groups = await prisma.contacts.groupBy({ by: ['type'], where: { deleted_at: null }, _count: { _all: true } })
  const metrics: ContactsMetrics = { total: 0, company: 0, individual: 0 }
  for (const group of groups) {
    metrics.total += group._count._all
    if (group.type === 'company') metrics.company = group._count._all
    if (group.type === 'individual') metrics.individual = group._count._all
  }
  return metrics
}

export async function getLogsForContact(contactId: string): Promise<LogDocument[]> {
  const rows = await prisma.audit_logs.findMany({
    where: { module: 'contacts', target: { path: ['id'], equals: contactId } },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: 10,
  })
  return toRows('audit_logs', rows).map(mapLogRow)
}
