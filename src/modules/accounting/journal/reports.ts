import type { JournalAccount, JournalAccountType, JournalCurrency, JournalDashboard, JournalEntry, JournalLine, JournalParty, JournalStatement, JournalValuation } from './types'
import { centsToMoney, moneyToCents } from './validation'

export interface ReportAccount {
  code: string; nameEn: string; nameAr: string; type: JournalAccountType
  parentCode: string | null; postable: boolean; requiresContact: boolean; active: boolean
}
const zero = () => BigInt(0)
type Totals = { debit: bigint; credit: bigint }
const empty = (): Totals => ({ debit: zero(), credit: zero() })
const cashAccounts = new Set(['1101', '1102'])
export function monthBounds(month: string) {
  const start = `${month}-01`
  const endDate = new Date(`${start}T00:00:00.000Z`)
  endDate.setUTCMonth(endDate.getUTCMonth() + 1)
  return { start, end: endDate.toISOString().slice(0, 10), asOf: new Date(endDate.getTime() - 86400000).toISOString().slice(0, 10) }
}
function isValued(entry: JournalEntry) {
  return Boolean(entry.exchangeRate && entry.lines.every((line) => line.baseDebit !== null && line.baseCredit !== null))
}
function coverage(entries: JournalEntry[], month: string) {
  const end = monthBounds(month).end
  const historical = entries.filter((entry) => entry.date < end)
  const unvalued = historical.filter((entry) => !isValued(entry)).length
  return { valued: historical.length - unvalued, unvalued, warning: unvalued ? `${unvalued} historical journal entries have no confirmed EGP valuation. Consolidated reports are blocked; transaction-currency reports remain available.` : null }
}
function selectedEntries(entries: JournalEntry[], currency: JournalCurrency, month: string, valuation: JournalValuation) {
  const end = monthBounds(month).end
  return entries.filter((entry) => entry.date < end && (valuation === 'functional' ? isValued(entry) : entry.currency === currency))
}
function amounts(line: JournalLine, valuation: JournalValuation): Totals {
  return { debit: moneyToCents((valuation === 'functional' ? line.baseDebit : line.debit) ?? '0'), credit: moneyToCents((valuation === 'functional' ? line.baseCredit : line.credit) ?? '0') }
}
function add(map: Map<string, Totals>, key: string, amount: Totals) {
  const total = map.get(key) ?? empty()
  total.debit += amount.debit; total.credit += amount.credit; map.set(key, total)
}
const debitNet = (amount: Totals) => amount.debit - amount.credit
const creditNet = (amount: Totals) => amount.credit - amount.debit
function splitNet(net: bigint) { return { debit: centsToMoney(net > zero() ? net : zero()), credit: centsToMoney(net < zero() ? -net : zero()) } }

export function buildJournalReports(accounts: ReportAccount[], entries: JournalEntry[], currency: JournalCurrency, month: string, valuation: JournalValuation): Pick<JournalDashboard, 'accounts' | 'parties' | 'health' | 'owner' | 'trend' | 'reports' | 'reportingCoverage' | 'functionalCurrency' | 'valuation'> {
  const { start, end, asOf } = monthBounds(month)
  const selected = selectedEntries(entries, currency, month, valuation)
  const byCode = new Map(accounts.map((account) => [account.code, account]))
  const closingTotals = new Map<string, Totals>(), openingTotals = new Map<string, Totals>(), periodTotals = new Map<string, Totals>()
  const parties = new Map<string, { name: string; totals: Totals; receivable: bigint; payable: bigint; deposits: bigint }>()
  const days = new Map<string, { revenue: bigint; expenses: bigint; cashIn: bigint; cashOut: bigint }>()
  for (const day = new Date(`${start}T00:00:00.000Z`); day.toISOString().slice(0, 10) < end; day.setUTCDate(day.getUTCDate() + 1)) days.set(day.toISOString().slice(0, 10), { revenue: zero(), expenses: zero(), cashIn: zero(), cashOut: zero() })
  let periodDebit = zero(), periodCredit = zero(), entryCount = 0
  for (const entry of selected) {
    const inPeriod = entry.date >= start
    const daily = inPeriod ? days.get(entry.date) : undefined
    let cashMovement = zero()
    if (inPeriod) entryCount++
    for (const line of entry.lines) {
      const amount = amounts(line, valuation)
      add(closingTotals, line.accountCode, amount)
      add(inPeriod ? periodTotals : openingTotals, line.accountCode, amount)
      const account = byCode.get(line.accountCode)
      if (inPeriod) {
        periodDebit += amount.debit; periodCredit += amount.credit
        if (account?.type === 'revenue') daily!.revenue += creditNet(amount)
        if (account?.type === 'expense') daily!.expenses += debitNet(amount)
        if (cashAccounts.has(line.accountCode)) cashMovement += debitNet(amount)
      }
      if (line.contactId && account?.requiresContact) {
        const party = parties.get(line.contactId) ?? { name: line.contactName ?? line.contactId, totals: empty(), receivable: zero(), payable: zero(), deposits: zero() }
        party.totals.debit += amount.debit; party.totals.credit += amount.credit
        if (line.accountCode === '1201') party.receivable += debitNet(amount)
        if (line.accountCode === '2101') party.payable += creditNet(amount)
        if (line.accountCode === '2201') party.deposits += creditNet(amount)
        parties.set(line.contactId, party)
      }
    }
    // Net cash per entry removes bank/cash transfers without counting both sides.
    if (daily && cashMovement > zero()) daily.cashIn += cashMovement
    if (daily && cashMovement < zero()) daily.cashOut -= cashMovement
  }
  const children = new Map<string, string[]>()
  for (const account of accounts) if (account.parentCode) children.set(account.parentCode, [...(children.get(account.parentCode) ?? []), account.code])
  function rollup(code: string, seen = new Set<string>()): Totals {
    if (seen.has(code)) throw new Error('Invalid accounting chart hierarchy')
    const total = { ...(closingTotals.get(code) ?? empty()) }
    for (const child of children.get(code) ?? []) {
      const childTotal = rollup(child, new Set([...seen, code]))
      total.debit += childTotal.debit; total.credit += childTotal.credit
    }
    return total
  }
  const chart: JournalAccount[] = accounts.map((account) => {
    const total = rollup(account.code)
    return { ...account, postable: account.active && account.postable && !(children.get(account.code)?.length), debit: centsToMoney(total.debit), credit: centsToMoney(total.credit), balance: centsToMoney(account.type === 'asset' || account.type === 'expense' ? debitNet(total) : creditNet(total)) }
  })
  function typeNet(map: Map<string, Totals>, type: JournalAccountType, debitNormal: boolean) {
    return accounts.filter((account) => account.type === type).reduce((sum, account) => sum + (debitNormal ? debitNet(map.get(account.code) ?? empty()) : creditNet(map.get(account.code) ?? empty())), zero())
  }
  const revenue = typeNet(periodTotals, 'revenue', false), expenses = typeNet(periodTotals, 'expense', true)
  const assets = typeNet(closingTotals, 'asset', true), liabilities = typeNet(closingTotals, 'liability', false), equity = typeNet(closingTotals, 'equity', false)
  const earnings = typeNet(closingTotals, 'revenue', false) - typeNet(closingTotals, 'expense', true)
  const reportingCoverage = coverage(entries, month)
  const available = valuation !== 'functional' || reportingCoverage.unvalued === 0
  const partyRows: JournalParty[] = [...parties].map(([contactId, party]) => ({ contactId, name: party.name, debit: centsToMoney(party.totals.debit), credit: centsToMoney(party.totals.credit), balance: centsToMoney(debitNet(party.totals)), receivable: centsToMoney(party.receivable), payable: centsToMoney(party.payable), deposits: centsToMoney(party.deposits) }))
  return {
    functionalCurrency: 'EGP', valuation, reportingCoverage, accounts: chart, parties: partyRows,
    health: { debit: centsToMoney(periodDebit), credit: centsToMoney(periodCredit), balanced: periodDebit === periodCredit, entryCount },
    owner: {
      cash: centsToMoney([...cashAccounts].reduce((sum, code) => sum + debitNet(closingTotals.get(code) ?? empty()), zero())),
      receivable: centsToMoney(debitNet(closingTotals.get('1201') ?? empty())), payable: centsToMoney(creditNet(closingTotals.get('2101') ?? empty())),
      monthRevenue: centsToMoney(revenue), monthExpenses: centsToMoney(expenses), monthProfit: centsToMoney(revenue - expenses),
    },
    trend: [...days].map(([date, day]) => ({ date, revenue: centsToMoney(day.revenue), expenses: centsToMoney(day.expenses), profit: centsToMoney(day.revenue - day.expenses), cashIn: centsToMoney(day.cashIn), cashOut: centsToMoney(day.cashOut) })),
    reports: {
      available,
      trialBalance: available ? accounts.filter((account) => !(children.get(account.code)?.length) || closingTotals.has(account.code)).map((account) => {
        const opening = splitNet(debitNet(openingTotals.get(account.code) ?? empty())), closing = splitNet(debitNet(closingTotals.get(account.code) ?? empty())), movement = periodTotals.get(account.code) ?? empty()
        return { code: account.code, nameEn: account.nameEn, nameAr: account.nameAr, type: account.type, openingDebit: opening.debit, openingCredit: opening.credit, periodDebit: centsToMoney(movement.debit), periodCredit: centsToMoney(movement.credit), closingDebit: closing.debit, closingCredit: closing.credit }
      }) : [],
      incomeStatement: available ? { revenue: centsToMoney(revenue), expenses: centsToMoney(expenses), profit: centsToMoney(revenue - expenses) } : null,
      balanceSheet: available ? { asOf, assets: centsToMoney(assets), liabilities: centsToMoney(liabilities), equity: centsToMoney(equity), currentEarnings: centsToMoney(earnings), balanced: assets === liabilities + equity + earnings } : null,
    },
  }
}

export function buildAccountStatement(accounts: ReportAccount[], entries: JournalEntry[], currency: JournalCurrency, month: string, valuation: JournalValuation, accountCode: string, contactId?: string): JournalStatement {
  const { start } = monthBounds(month)
  const selected = selectedEntries(entries, currency, month, valuation).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const codes = new Set([accountCode])
  // Heading statements include descendants while counting each posted line once.
  for (let changed = true; changed;) {
    changed = false
    for (const account of accounts) if (account.parentCode && codes.has(account.parentCode) && !codes.has(account.code)) { codes.add(account.code); changed = true }
  }
  const warning = coverage(entries, month).warning
  const available = valuation !== 'functional' || !warning
  let opening = zero(), running = zero()
  const lines: JournalStatement['lines'] = []
  if (available) for (const entry of selected) for (const line of entry.lines) {
    if (!codes.has(line.accountCode) || (contactId && line.contactId !== contactId)) continue
    const amount = amounts(line, valuation)
    running += debitNet(amount)
    if (entry.date < start) { opening = running; continue }
    lines.push({ entryId: entry.id, entryNumber: entry.entryNumber, date: entry.date, description: line.description || entry.description, contactId: line.contactId, contactName: line.contactName, debit: centsToMoney(amount.debit), credit: centsToMoney(amount.credit), runningBalance: centsToMoney(running) })
  }
  return { accountCode, currency, valuation, month, opening: centsToMoney(opening), closing: centsToMoney(running), lines, available, warning: valuation === 'functional' ? warning : null }
}
