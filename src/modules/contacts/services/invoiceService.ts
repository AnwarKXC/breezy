import 'server-only'

import { prisma } from '@/services/db/prisma'
import { toRow } from '@/services/db/rows'
import type { Invoice, InvoiceStatus } from '../types/invoiceTypes'
import { requireContactsRead } from './serviceSecurity'

// Invoice writes live in the accounting module (accountingService), which
// enforces invoice permissions. This module only lists a contact's invoices.
export async function getInvoicesByContact(contactId: string): Promise<Invoice[]> {
  await requireContactsRead()
  const rows = await prisma.invoices.findMany({
    where: { contact_id: contactId, deleted_at: null },
    orderBy: { issue_date: 'desc' },
    take: 50,
  })
  return rows.map((raw) => {
    const row = toRow('invoices', raw)
    return {
      id: row.id,
      contactId: row.contact_id,
      invoiceNumber: row.invoice_number,
      amount: row.amount,
      currency: row.currency,
      status: row.status as InvoiceStatus,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      paidAt: row.paid_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  })
}
