import 'server-only'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@/generated/prisma/client'
import { prisma, type DbTransaction } from '@/services/db/prisma'
import { requireLedgerRead, requireAccountingWrite, requireAccountingSettings } from '../services/serviceSecurity'
import { centsToMoney, moneyToCents, JournalCreateSchema, JournalDraftSchema, JournalReverseSchema, JournalPeriodSchema, JournalCurrencySchema, JournalMonthSchema, JournalValuationSchema, JournalRevaluationSchema, type JournalCreateInput, type JournalRevaluationInput } from './validation'
import type { JournalCurrency, JournalDashboard, JournalEntry, JournalPeriod, JournalStatement, JournalValuation, JournalRevaluation } from './types'
import { valueJournalLines } from './fx'
import { buildJournalReports, buildAccountStatement, monthBounds, type ReportAccount } from './reports'
import { revaluationAmounts } from './revaluation'

export class JournalDomainError extends Error {}

const entryInclude = { lines: { orderBy: { sort_order: 'asc' as const } }, reversed_by: { select: { id: true } } } satisfies Prisma.accounting_journal_entriesInclude
type EntryRow = Prisma.accounting_journal_entriesGetPayload<{ include: typeof entryInclude }>

function mapEntry(entry: EntryRow, contacts: Map<string, string>): JournalEntry {
  return {
    kind: entry.kind as JournalEntry['kind'],
    id: entry.id, entryNumber: entry.entry_number, date: entry.date.toISOString().slice(0, 10),
    currency: entry.currency as JournalCurrency, description: entry.description, createdBy: entry.created_by,
    createdAt: entry.created_at.toISOString(), reversalOfId: entry.reversal_of_id, reversedById: entry.reversed_by?.id ?? null,
    total: centsToMoney(entry.lines.reduce((sum, line) => sum + moneyToCents(line.debit.toFixed(2)), BigInt(0))),
    exchangeRate: entry.exchange_rate?.toFixed(8) ?? null,
    exchangeRateDate: entry.exchange_rate_date?.toISOString().slice(0, 10) ?? null,
    exchangeRateSource: entry.exchange_rate_source,
    baseTotal: entry.lines.every((line) => line.base_debit !== null && line.base_credit !== null) ? centsToMoney(entry.lines.reduce((sum, line) => sum + moneyToCents(line.base_debit!.toFixed(2)), BigInt(0))) : null,
    lines: entry.lines.map((line) => ({
      id: line.id, accountCode: line.account_code, contactId: line.contact_id,
      contactName: line.contact_id ? contacts.get(line.contact_id) ?? null : null,
      debit: line.debit.toFixed(2), credit: line.credit.toFixed(2), description: line.description,
      baseDebit: line.base_debit?.toFixed(2) ?? null, baseCredit: line.base_credit?.toFixed(2) ?? null,
    })),
  }
}

async function lockOpenPeriod(tx: DbTransaction, date: string, currency: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`accounting-currency:${currency}`}, 0))`
  const month = date.slice(0, 7)
  await tx.$executeRaw`INSERT INTO public.accounting_periods(month) VALUES (${month}) ON CONFLICT DO NOTHING`
  const periods = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM public.accounting_periods WHERE month = ${month} FOR UPDATE`
  if (periods[0]?.status !== 'open') throw new JournalDomainError('This accounting period is closed or locked')
}

async function validateReferences(tx: DbTransaction, input: JournalCreateInput, isReversal = false) {
  const codes = [...new Set(input.lines.map((line) => line.accountCode))]
  const accounts = await tx.accounting_accounts.findMany({ where: { code: { in: codes } }, include: { _count: { select: { children: true } } } })
  const byCode = new Map(accounts.map((account) => [account.code, account]))
  const contactIds = [...new Set(input.lines.flatMap((line) => line.contactId ? [line.contactId] : []))]
  const contacts = await tx.contacts.findMany({ where: { id: { in: contactIds }, ...(isReversal ? {} : { deleted_at: null }) }, select: { id: true, name: true } })
  const contactNames = new Map(contacts.map((contact) => [contact.id, contact.name]))
  for (const line of input.lines) {
    const account = byCode.get(line.accountCode)
    if (!account) throw new JournalDomainError(`Account ${line.accountCode} does not exist`)
    // Exact inverse reversals retain their original references even after archival.
    if (!isReversal && (!account.active || !account.postable || account._count.children > 0)) throw new JournalDomainError(`Account ${line.accountCode} must be an active postable account`)
    if (!isReversal && account.requires_contact && !line.contactId) throw new JournalDomainError(`Account ${line.accountCode} requires a contact`)
    if (line.contactId && !contactNames.has(line.contactId)) throw new JournalDomainError('A selected contact does not exist or is inactive')
  }
  return contactNames
}

async function insertEntry(tx: DbTransaction, input: JournalCreateInput, actorId: string, original?: EntryRow) {
  const reversalOfId = original?.id
  const contacts = await validateReferences(tx, input, Boolean(reversalOfId))
  const rate = original ? original.exchange_rate?.toFixed(8) ?? null : input.currency === 'EGP' ? '1' : input.exchangeRate ?? null
  const baseLines = original ? original.lines.map((line) => ({ baseDebit: line.base_credit?.toFixed(2) ?? null, baseCredit: line.base_debit?.toFixed(2) ?? null })) : rate ? valueJournalLines(input.lines, rate) : input.lines.map(() => ({ baseDebit: null, baseCredit: null }))
  const entry = await tx.accounting_journal_entries.create({
    data: {
      entry_number: `JE-${input.date.replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
      date: new Date(`${input.date}T00:00:00.000Z`), currency: input.currency,
      description: input.description, created_by: actorId, reversal_of_id: reversalOfId,
      exchange_rate: rate ? new Prisma.Decimal(rate) : null,
      exchange_rate_date: original ? original.exchange_rate_date : new Date(`${input.date}T00:00:00.000Z`),
      exchange_rate_source: original ? original.exchange_rate_source : input.currency === 'EGP' ? 'functional-currency' : input.exchangeRateSource ?? 'manual',
      lines: { create: input.lines.map((line, index) => ({
        account_code: line.accountCode, contact_id: line.contactId ?? null,
        debit: new Prisma.Decimal(line.debit), credit: new Prisma.Decimal(line.credit),
        base_debit: baseLines[index].baseDebit === null ? null : new Prisma.Decimal(baseLines[index].baseDebit!),
        base_credit: baseLines[index].baseCredit === null ? null : new Prisma.Decimal(baseLines[index].baseCredit!),
        description: line.description, sort_order: index,
      })) },
    },
    include: entryInclude,
  })
  return mapEntry(entry, contacts)
}

export async function createJournalEntry(rawInput: JournalCreateInput) {
  const session = await requireAccountingWrite()
  const input = JournalCreateSchema.parse(rawInput)
  return prisma.$transaction(async (tx) => {
    await lockOpenPeriod(tx, input.date, input.currency)
    return insertEntry(tx, input, session.id)
  })
}

export async function reverseJournalEntry(id: string, rawInput: { date: string; reason: string }) {
  const session = await requireAccountingWrite()
  const input = JournalReverseSchema.parse(rawInput)
  return prisma.$transaction(async (tx) => {
    const initial = await tx.accounting_journal_entries.findUnique({ where: { id }, select: { currency: true, kind: true } })
    if (!initial) throw new JournalDomainError('Journal entry was not found')
    if (initial.kind === 'revaluation') throw new JournalDomainError('Correct a revaluation through a later closing-rate operation')
    // Currency, period, then header: all journal writers use the same lock order.
    await lockOpenPeriod(tx, input.date, initial.currency)
    await tx.$queryRaw`SELECT id FROM public.accounting_journal_entries WHERE id = ${id}::uuid FOR UPDATE`
    const original = await tx.accounting_journal_entries.findUnique({ where: { id }, include: entryInclude })
    if (!original) throw new JournalDomainError('Journal entry was not found')
    if (original.reversal_of_id) throw new JournalDomainError('A reversal entry cannot itself be reversed')
    if (original.reversed_by) throw new JournalDomainError('This entry has already been reversed')
    if (input.date < original.date.toISOString().slice(0, 10)) throw new JournalDomainError('Reversal date cannot precede the original entry')
    const reversed = JournalDraftSchema.parse({
      date: input.date, currency: original.currency, description: `Reversal ${original.entry_number}: ${input.reason}`.slice(0, 1000),
      lines: original.lines.map((line) => ({
        accountCode: line.account_code, contactId: line.contact_id,
        debit: line.credit.toFixed(2), credit: line.debit.toFixed(2), description: line.description,
      })),
    })
    return insertEntry(tx, reversed, session.id, original)
  })
}

export async function changeJournalPeriod(rawInput: { month: string; action: 'close' | 'reopen' | 'lock' }): Promise<JournalPeriod> {
  const session = await requireAccountingSettings()
  const input = JournalPeriodSchema.parse(rawInput)
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO public.accounting_periods(month) VALUES (${input.month}) ON CONFLICT DO NOTHING`
    const rows = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM public.accounting_periods WHERE month = ${input.month} FOR UPDATE`
    if (rows[0]?.status === 'locked') throw new JournalDomainError('A locked period cannot be changed')
    const status = input.action === 'reopen' ? 'open' : input.action === 'close' ? 'closed' : 'locked'
    await tx.accounting_periods.update({ where: { month: input.month }, data: { status, updated_by: session.id, updated_at: new Date() } })
    return { month: input.month, status }
  })
}

async function readReportingData(tx: DbTransaction, month: string) {
  const end = new Date(`${monthBounds(month).end}T00:00:00.000Z`)
  const [accountRows, rows, contacts] = await Promise.all([
    tx.accounting_accounts.findMany({ orderBy: { code: 'asc' } }),
    tx.accounting_journal_entries.findMany({ where: { date: { lt: end } }, orderBy: [{ date: 'desc' }, { created_at: 'desc' }, { id: 'desc' }], include: entryInclude }),
    tx.contacts.findMany({ select: { id: true, name: true, deleted_at: true }, orderBy: { name: 'asc' } }),
  ])
  const names = new Map(contacts.map((contact) => [contact.id, contact.name]))
  const accounts: ReportAccount[] = accountRows.map((account) => ({
    code: account.code, nameEn: account.name_en, nameAr: account.name_ar, type: account.type as ReportAccount['type'],
    parentCode: account.parent_code, postable: account.postable, requiresContact: account.requires_contact, active: account.active,
  }))
  return { accounts, entries: rows.map((entry) => mapEntry(entry, names)), contacts }
}

function validateReportQuery(currency: JournalCurrency, month: string, valuation: JournalValuation) {
  JournalCurrencySchema.parse(currency); JournalMonthSchema.parse(month); JournalValuationSchema.parse(valuation)
  if (valuation === 'functional' && currency !== 'EGP') throw new JournalDomainError('Functional reports use EGP')
}

export async function getJournalDashboard(currency: JournalCurrency, month: string, valuation: JournalValuation = 'native'): Promise<JournalDashboard> {
  await requireLedgerRead()
  validateReportQuery(currency, month, valuation)
  return prisma.$transaction(async (tx) => {
    const data = await readReportingData(tx, month)
    const periods = await tx.accounting_periods.findMany({ orderBy: { month: 'desc' } })
    const revaluations = await tx.accounting_revaluations.findMany({ where: { date: { lt: new Date(`${monthBounds(month).end}T00:00:00.000Z`) }, ...(valuation === 'native' ? { currency } : {}) }, orderBy: [{ date: 'desc' }, { created_at: 'desc' }] })
    const mappedPeriods = periods.map((period) => ({ month: period.month, status: period.status as JournalPeriod['status'] }))
    if (!mappedPeriods.some((period) => period.month === month)) mappedPeriods.push({ month, status: 'open' })
    mappedPeriods.sort((a, b) => b.month.localeCompare(a.month))
    return {
      ...buildJournalReports(data.accounts, data.entries, currency, month, valuation),
      revaluations: revaluations.map(mapRevaluation),
      entries: data.entries.filter((entry) => entry.date >= `${month}-01` && (valuation === 'functional' ? true : entry.currency === currency)),
      periods: mappedPeriods,
      contacts: data.contacts.filter((contact) => !contact.deleted_at).map(({ id, name }) => ({ id, name })),
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 })
}

function mapRevaluation(row: Prisma.accounting_revaluationsGetPayload<Record<string, never>>): JournalRevaluation {
  return { id: row.id, entryId: row.entry_id, date: row.date.toISOString().slice(0, 10), currency: row.currency as JournalCurrency, accountCode: row.account_code, contactId: row.contact_id, closingRate: row.closing_rate.toFixed(8), source: row.source, nativeBalance: row.native_balance.toFixed(2), baseBefore: row.base_before.toFixed(2), baseAfter: row.base_after.toFixed(2), delta: row.delta.toFixed(2) }
}

export async function createJournalRevaluation(rawInput: JournalRevaluationInput): Promise<JournalRevaluation> {
  const session = await requireAccountingWrite()
  const input = JournalRevaluationSchema.parse(rawInput)
  return prisma.$transaction(async (tx) => {
    await lockOpenPeriod(tx, input.date, input.currency)
    const contactId = input.contactId ?? null
    const scoped = await tx.accounting_journal_lines.findMany({
      where: { account_code: input.accountCode, ...(contactId ? { contact_id: contactId } : {}), entry: { currency: input.currency } },
      select: { debit: true, credit: true, base_debit: true, base_credit: true, entry: { select: { date: true } } },
    })
    if (!scoped.length) throw new JournalDomainError('This monetary scope has no journal history')
    if (scoped.some((line) => line.entry.date.toISOString().slice(0, 10) > input.date)) throw new JournalDomainError('Revaluation cannot precede later postings for this monetary scope')
    if (scoped.some((line) => line.base_debit === null || line.base_credit === null)) throw new JournalDomainError('This monetary scope contains unknown historical EGP valuations')
    const previous = await tx.accounting_revaluations.findFirst({ where: { currency: input.currency, account_code: input.accountCode, contact_id: contactId }, orderBy: { date: 'desc' } })
    if (previous && previous.date.toISOString().slice(0, 10) >= input.date) throw new JournalDomainError('A closing-rate operation already exists on or after this date for this scope')
    const nativeBalance = scoped.reduce((sum, line) => sum + moneyToCents(line.debit.toFixed(2)) - moneyToCents(line.credit.toFixed(2)), BigInt(0))
    const carrying = scoped.reduce((sum, line) => sum + moneyToCents(line.base_debit!.toFixed(2)) - moneyToCents(line.base_credit!.toFixed(2)), BigInt(0))
    const values = revaluationAmounts(centsToMoney(nativeBalance), centsToMoney(carrying), input.closingRate)
    const delta = moneyToCents(values.delta), absolute = delta < BigInt(0) ? -delta : delta
    if (delta === BigInt(0)) throw new JournalDomainError('This closing rate requires no EGP adjustment')
    if (absolute >= BigInt(10) ** BigInt(24)) throw new JournalDomainError('This adjustment exceeds the journal amount limit')
    const amount = centsToMoney(absolute)
    const entry = await tx.accounting_journal_entries.create({ data: {
      kind: 'revaluation', entry_number: `FXR-${input.date.replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
      date: new Date(`${input.date}T00:00:00.000Z`), currency: input.currency,
      description: `Closing-rate revaluation ${input.accountCode} (${input.currency})`, created_by: session.id,
      exchange_rate: new Prisma.Decimal(input.closingRate), exchange_rate_date: new Date(`${input.date}T00:00:00.000Z`), exchange_rate_source: input.source,
      lines: { create: [
        { account_code: input.accountCode, contact_id: contactId, debit: 0, credit: 0, base_debit: delta > BigInt(0) ? amount : '0', base_credit: delta < BigInt(0) ? amount : '0', sort_order: 0, description: input.source },
        { account_code: delta > BigInt(0) ? '4402' : '5602', debit: 0, credit: 0, base_debit: delta < BigInt(0) ? amount : '0', base_credit: delta > BigInt(0) ? amount : '0', sort_order: 1, description: 'Unrealized foreign exchange difference' },
      ] },
    } })
    const operation = await tx.accounting_revaluations.create({ data: {
      entry_id: entry.id, date: entry.date, currency: input.currency, account_code: input.accountCode, contact_id: contactId,
      closing_rate: new Prisma.Decimal(input.closingRate), source: input.source,
      native_balance: new Prisma.Decimal(values.nativeBalance), base_before: new Prisma.Decimal(values.baseBefore), base_after: new Prisma.Decimal(values.baseAfter), delta: new Prisma.Decimal(values.delta), created_by: session.id,
    } })
    return mapRevaluation(operation)
  }, { timeout: 15000 })
}

export async function getJournalAccountStatement(currency: JournalCurrency, month: string, valuation: JournalValuation, accountCode: string, contactId?: string): Promise<JournalStatement> {
  await requireLedgerRead()
  validateReportQuery(currency, month, valuation)
  return prisma.$transaction(async (tx) => {
    const data = await readReportingData(tx, month)
    if (!data.accounts.some((account) => account.code === accountCode)) throw new JournalDomainError('Account was not found')
    if (contactId && !data.contacts.some((contact) => contact.id === contactId)) throw new JournalDomainError('Contact was not found')
    return buildAccountStatement(data.accounts, data.entries, currency, month, valuation, accountCode, contactId)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 })
}
