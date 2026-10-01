import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AuthAccessError } from '@/services/auth/serverSession'
import { JournalDomainError } from '@/modules/accounting/journal/service'

export function journalError(error: unknown) {
  if (error instanceof SyntaxError || error instanceof ZodError) return NextResponse.json({ error: error instanceof ZodError ? error.issues.map((issue) => issue.message).join('; ') : 'Invalid JSON request' }, { status: 400 })
  if (error instanceof AuthAccessError) return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  if (error instanceof JournalDomainError) return NextResponse.json({ error: error.message }, { status: 409 })
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (code === 'P2021' || code === 'P2022') return NextResponse.json({ error: 'The manual journal requires its database migration before it can be used' }, { status: 503 })
  if (code === 'P2002') return NextResponse.json({ error: 'This journal entry has already been reversed or its number already exists' }, { status: 409 })
  if (code === 'P2004') return NextResponse.json({ error: 'The journal operation violates an accounting constraint' }, { status: 409 })
  return NextResponse.json({ error: 'Unable to complete the journal operation' }, { status: 500 })
}
