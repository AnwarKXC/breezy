import 'server-only'

import { randomUUID } from 'crypto'
import type { Prisma } from '@/generated/prisma/client'
import { prisma, type DbTransaction } from '@/services/db/prisma'
import { dbDate, toRow } from '@/services/db/rows'
import { mapLedgerEntryRow } from '../types'
import { requireLedgerRead } from './serviceSecurity'
import { logLedgerEntryCreated } from './activityLogService'

export async function createLedgerEntry(
  input: {
    type: string; sourceType: string; sourceId: string;
    incomeAmount: number; outcomeAmount: number; currency: string;
    description: string; createdBy: string;
    invoiceId?: string; contactId?: string; metadata?: Record<string, unknown>
  },
  tx: DbTransaction | typeof prisma = prisma,
) {
  const row = await tx.accounting_ledger_entries.create({
    data: {
      transaction_number: `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      type: input.type,
      source_type: input.sourceType,
      source_id: input.sourceId,
      invoice_id: input.invoiceId ?? null,
      contact_id: input.contactId ?? null,
      income_amount: input.incomeAmount,
      outcome_amount: input.outcomeAmount,
      currency: input.currency,
      description: input.description,
      created_by: input.createdBy,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  })
  void logLedgerEntryCreated({ id: row.id, transactionNumber: row.transaction_number, type: row.type, amount: input.incomeAmount || input.outcomeAmount })
  return mapLedgerEntryRow(toRow('accounting_ledger_entries', row))
}

export async function getLedgerEntries(params?: {
  fromDate?: string; toDate?: string; type?: string; sourceType?: string;
  sourceId?: string; limit?: number; offset?: number
}) {
  await requireLedgerRead()
  const where: Prisma.accounting_ledger_entriesWhereInput = {}
  if (params?.fromDate || params?.toDate) {
    where.transaction_date = {
      ...(params?.fromDate ? { gte: dbDate(params.fromDate) } : {}),
      ...(params?.toDate ? { lte: dbDate(params.toDate) } : {}),
    }
  }
  if (params?.type) where.type = params.type
  if (params?.sourceType) where.source_type = params.sourceType
  if (params?.sourceId) where.source_id = params.sourceId

  const rows = await prisma.accounting_ledger_entries.findMany({
    where,
    orderBy: { created_at: 'desc' },
    skip: Number(params?.offset ?? 0),
    take: Math.min(Number(params?.limit ?? 100), 1000),
  })
  return rows.map((row) => mapLedgerEntryRow(toRow('accounting_ledger_entries', row)))
}
