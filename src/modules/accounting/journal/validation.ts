import { z } from 'zod'

export const JournalCurrencySchema = z.enum(['EGP', 'USD', 'EUR', 'GBP'])
export const JournalValuationSchema = z.enum(['native', 'functional'])
export const JournalExchangeRateSchema = z.string().regex(/^\d{1,10}(\.\d{1,8})?$/, 'Exchange rate must be a positive decimal with at most eight decimal places').refine((value) => /[1-9]/.test(value), 'Exchange rate must be positive')
export const JournalMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine((value) => Number(value.slice(0, 4)) >= 2000, 'Year must be 2000 or later')
export const JournalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number(value.slice(0, 4)) >= 2000 && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Invalid calendar date')
export function moneyToCents(value: string): bigint {
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.')
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'))
  return negative ? -cents : cents
}
export function centsToMoney(value: bigint): string {
  const absolute = value < BigInt(0) ? -value : value
  return `${value < BigInt(0) ? '-' : ''}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`
}
const amountPattern = /^\d{1,10}(\.\d{1,2})?$/
const amount = z.string().regex(amountPattern, 'Amount must be a decimal string with at most two decimal places').default('0')
const line = z.object({
  accountCode: z.string().regex(/^\d{1,12}$/),
  contactId: z.uuid().nullable().optional(),
  debit: amount,
  credit: amount,
  description: z.string().trim().max(500).default(''),
}).strict().superRefine((value, context) => {
  if (!amountPattern.test(value.debit) || !amountPattern.test(value.credit)) return
  const debit = moneyToCents(value.debit), credit = moneyToCents(value.credit)
  if ((debit > BigInt(0)) === (credit > BigInt(0))) context.addIssue({ code: 'custom', message: 'A line must have exactly one positive debit or credit' })
})
export const JournalDraftSchema = z.object({
  date: JournalDateSchema,
  currency: JournalCurrencySchema,
  exchangeRate: JournalExchangeRateSchema.optional(),
  exchangeRateSource: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(1000),
  lines: z.array(line).min(2).max(100),
}).strict().superRefine((value, context) => {
  if (value.lines.some((item) => !amountPattern.test(item.debit) || !amountPattern.test(item.credit))) return
  if (value.lines.reduce((sum, item) => sum + moneyToCents(item.debit) - moneyToCents(item.credit), BigInt(0)) !== BigInt(0)) context.addIssue({ code: 'custom', path: ['lines'], message: 'Debits and credits must balance exactly' })
  const netByAccountContact = new Map<string, bigint>()
  for (const item of value.lines) {
    const key = `${item.accountCode}:${item.contactId ?? ''}`
    netByAccountContact.set(key, (netByAccountContact.get(key) ?? BigInt(0)) + moneyToCents(item.debit) - moneyToCents(item.credit))
  }
  if ([...netByAccountContact.values()].every((net) => net === BigInt(0))) context.addIssue({ code: 'custom', path: ['lines'], message: 'Entry must change at least one account or contact balance' })
})
export const JournalCreateSchema = JournalDraftSchema.superRefine((value, context) => {
  if (value.currency !== 'EGP' && !value.exchangeRate) context.addIssue({ code: 'custom', path: ['exchangeRate'], message: 'Foreign-currency journals require the historical EGP exchange rate' })
  if (value.currency === 'EGP' && value.exchangeRate && !/^0*1(\.0{1,8})?$/.test(value.exchangeRate)) context.addIssue({ code: 'custom', path: ['exchangeRate'], message: 'EGP journals must use an exchange rate of one' })
})
export const JournalReverseSchema = z.object({ date: JournalDateSchema, reason: z.string().trim().min(1).max(500) }).strict()
export const JournalPeriodSchema = z.object({ month: JournalMonthSchema, action: z.enum(['close', 'reopen', 'lock']) }).strict()
export const JournalRevaluationSchema = z.object({
  date: JournalDateSchema, currency: z.enum(['USD', 'EUR', 'GBP']), accountCode: z.enum(['1101', '1102', '1201', '2101']),
  contactId: z.uuid().nullable().optional(), closingRate: JournalExchangeRateSchema, source: z.string().trim().min(1).max(200),
}).strict().superRefine((value, context) => {
  const control = value.accountCode === '1201' || value.accountCode === '2101'
  if (control && !value.contactId) context.addIssue({ code: 'custom', path: ['contactId'], message: 'Receivable and payable revaluations require a contact' })
  if (!control && value.contactId) context.addIssue({ code: 'custom', path: ['contactId'], message: 'Cash and bank revaluations cover the whole currency account' })
})
export type JournalRevaluationInput = z.infer<typeof JournalRevaluationSchema>
export type JournalCreateInput = z.infer<typeof JournalCreateSchema>
