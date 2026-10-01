import type { JournalWorkspace, CreateJournalInput, JournalStatement } from './types'

async function journalRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/accounting/journal${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.error ?? 'Unable to load the general journal')
  return result.data as T
}

export function fetchJournalWorkspace(currency: string, month: string, signal?: AbortSignal, valuation: 'native' | 'functional' = 'native') {
  return journalRequest<JournalWorkspace>(`?${new URLSearchParams({ currency, month, valuation })}`, { signal })
}

export function fetchJournalStatement(currency: string, month: string, valuation: 'native' | 'functional', accountCode: string, contactId: string, signal?: AbortSignal) {
  return journalRequest<JournalStatement>(`/statement?${new URLSearchParams({ currency, month, valuation, accountCode, ...(contactId ? { contactId } : {}) })}`, { signal })
}

export function postJournal(input: CreateJournalInput) {
  return journalRequest('', { method: 'POST', body: JSON.stringify(input) })
}

export function reverseJournal(id: string, date: string, reason: string) {
  return journalRequest(`/${encodeURIComponent(id)}/reverse`, { method: 'POST', body: JSON.stringify({ date, reason }) })
}

export function changeJournalPeriod(month: string, action: 'close' | 'reopen' | 'lock') {
  return journalRequest('/periods', { method: 'POST', body: JSON.stringify({ month, action }) })
}
