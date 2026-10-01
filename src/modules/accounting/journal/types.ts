export type JournalCurrency = 'EGP' | 'USD' | 'EUR' | 'GBP'
export type JournalValuation = 'native' | 'functional'
export type JournalAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export interface JournalAccount {
  code: string; nameEn: string; nameAr: string; type: JournalAccountType
  parentCode: string | null; postable: boolean; requiresContact: boolean
  debit: string; credit: string; balance: string
}
export interface JournalLine {
  id: string; accountCode: string; contactId: string | null; contactName: string | null
  debit: string; credit: string; description: string
  baseDebit: string | null; baseCredit: string | null
}
export interface JournalEntry {
  kind: 'manual' | 'revaluation'
  id: string; entryNumber: string; date: string; currency: JournalCurrency; description: string
  createdBy: string; createdAt: string; reversalOfId: string | null; reversedById: string | null
  lines: JournalLine[]; total: string
  exchangeRate: string | null; baseTotal: string | null
  exchangeRateDate: string | null; exchangeRateSource: string | null
}
export interface JournalRevaluation {
  id: string; entryId: string; date: string; currency: JournalCurrency; accountCode: string; contactId: string | null
  closingRate: string; source: string; nativeBalance: string; baseBefore: string; baseAfter: string; delta: string
}
export interface JournalPeriod { month: string; status: 'open' | 'closed' | 'locked' }
export interface JournalParty { contactId: string; name: string; debit: string; credit: string; balance: string; receivable: string; payable: string; deposits: string }
export interface JournalTrialBalanceRow {
  code: string; nameEn: string; nameAr: string; type: JournalAccountType
  openingDebit: string; openingCredit: string; periodDebit: string; periodCredit: string; closingDebit: string; closingCredit: string
}
export interface JournalIncomeStatement { revenue: string; expenses: string; profit: string }
export interface JournalBalanceSheet { asOf: string; assets: string; liabilities: string; equity: string; currentEarnings: string; balanced: boolean }
export interface JournalStatementLine { entryId: string; entryNumber: string; date: string; description: string; contactId: string | null; contactName: string | null; debit: string; credit: string; runningBalance: string }
export interface JournalStatement { accountCode: string; currency: JournalCurrency; valuation: JournalValuation; month: string; opening: string; closing: string; lines: JournalStatementLine[]; available: boolean; warning: string | null }
export interface JournalDashboard {
  revaluations: JournalRevaluation[]
  accounts: JournalAccount[]; entries: JournalEntry[]; periods: JournalPeriod[]
  parties: JournalParty[]; contacts: { id: string; name: string }[]
  health: { debit: string; credit: string; balanced: boolean; entryCount: number }
  functionalCurrency: 'EGP'; valuation: JournalValuation
  reportingCoverage: { valued: number; unvalued: number; warning: string | null }
  owner: { cash: string; receivable: string; payable: string; monthRevenue: string; monthExpenses: string; monthProfit: string }
  trend: { date: string; revenue: string; expenses: string; profit: string; cashIn: string; cashOut: string }[]
  reports: { available: boolean; trialBalance: JournalTrialBalanceRow[]; incomeStatement: JournalIncomeStatement | null; balanceSheet: JournalBalanceSheet | null }
}
export type JournalWorkspace = JournalDashboard
export type { JournalCreateInput as CreateJournalInput } from './validation'
