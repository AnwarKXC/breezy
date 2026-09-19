import 'server-only'

import { logAction } from '@/services/logs'
import { LOG_ACTIONS, LOG_MODULES, type LogAction } from '@/types/logs'

type AccountingAction =
  | 'payment_created'
  | 'payment_updated'
  | 'payment_deleted'
  | 'payment_refunded'
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'expense_approved'
  | 'expense_category_created'
  | 'expense_category_updated'
  | 'invoice_created'
  | 'invoice_updated'
  | 'invoice_issued'
  | 'invoice_voided'
  | 'invoice_refunded'
  | 'invoice_deleted'
  | 'ledger_entry_created'
  | 'ledger_reversal_created'
  | 'setting_updated'
  | 'report_exported'

const ACTION_MAP: Record<AccountingAction, LogAction> = {
  payment_created: LOG_ACTIONS.ACCOUNTING_CREATED,
  payment_updated: LOG_ACTIONS.ACCOUNTING_UPDATED,
  payment_deleted: LOG_ACTIONS.ACCOUNTING_DELETED,
  payment_refunded: LOG_ACTIONS.ACCOUNTING_UPDATED,
  expense_created: LOG_ACTIONS.ACCOUNTING_CREATED,
  expense_updated: LOG_ACTIONS.ACCOUNTING_UPDATED,
  expense_deleted: LOG_ACTIONS.ACCOUNTING_DELETED,
  expense_approved: LOG_ACTIONS.ACCOUNTING_UPDATED,
  expense_category_created: LOG_ACTIONS.ACCOUNTING_CREATED,
  expense_category_updated: LOG_ACTIONS.ACCOUNTING_UPDATED,
  invoice_created: LOG_ACTIONS.ACCOUNTING_CREATED,
  invoice_updated: LOG_ACTIONS.ACCOUNTING_UPDATED,
  invoice_issued: LOG_ACTIONS.ACCOUNTING_UPDATED,
  invoice_voided: LOG_ACTIONS.ACCOUNTING_UPDATED,
  invoice_refunded: LOG_ACTIONS.ACCOUNTING_UPDATED,
  invoice_deleted: LOG_ACTIONS.ACCOUNTING_DELETED,
  ledger_entry_created: LOG_ACTIONS.ACCOUNTING_CREATED,
  ledger_reversal_created: LOG_ACTIONS.ACCOUNTING_CREATED,
  setting_updated: LOG_ACTIONS.ACCOUNTING_UPDATED,
  report_exported: LOG_ACTIONS.ACCOUNTING_CREATED,
}

const DESCRIPTION_MAP: Record<AccountingAction, string> = {
  payment_created: 'logs.accounting.paymentCreated',
  payment_updated: 'logs.accounting.paymentUpdated',
  payment_deleted: 'logs.accounting.paymentDeleted',
  payment_refunded: 'logs.accounting.paymentRefunded',
  expense_created: 'logs.accounting.expenseCreated',
  expense_updated: 'logs.accounting.expenseUpdated',
  expense_deleted: 'logs.accounting.expenseDeleted',
  expense_approved: 'logs.accounting.expenseApproved',
  expense_category_created: 'logs.accounting.expenseCategoryCreated',
  expense_category_updated: 'logs.accounting.expenseCategoryUpdated',
  invoice_created: 'logs.accounting.invoiceCreated',
  invoice_updated: 'logs.accounting.invoiceUpdated',
  invoice_issued: 'logs.accounting.invoiceIssued',
  invoice_voided: 'logs.accounting.invoiceVoided',
  invoice_refunded: 'logs.accounting.invoiceRefunded',
  invoice_deleted: 'logs.accounting.invoiceDeleted',
  ledger_entry_created: 'logs.accounting.ledgerEntryCreated',
  ledger_reversal_created: 'logs.accounting.ledgerReversalCreated',
  setting_updated: 'logs.accounting.settingUpdated',
  report_exported: 'logs.accounting.reportExported',
}

export async function logPaymentCreated(entity: { id: string; invoiceId: string; amount: number; type: string }) {
  await logAction({
    action: ACTION_MAP.payment_created,
    description: DESCRIPTION_MAP.payment_created,
    entityId: entity.id,
    entityType: 'payment',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: `Payment ${entity.type} - ${entity.amount}`, type: 'payment' },
  })
}

export async function logPaymentRefunded(entity: { id: string; invoiceId: string; amount: number; reason?: string }) {
  await logAction({
    action: ACTION_MAP.payment_refunded,
    description: DESCRIPTION_MAP.payment_refunded,
    entityId: entity.id,
    entityType: 'payment',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: `Refund - ${entity.amount}`, type: 'payment' },
  })
}

export async function logPaymentDeleted(entityId: string) {
  await logAction({
    action: ACTION_MAP.payment_deleted,
    description: DESCRIPTION_MAP.payment_deleted,
    entityId,
    entityType: 'payment',
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entityId, type: 'payment' },
  })
}

export async function logExpenseCreated(entity: { id: string; description: string; amount: number }) {
  await logAction({
    action: ACTION_MAP.expense_created,
    description: DESCRIPTION_MAP.expense_created,
    entityId: entity.id,
    entityType: 'expense',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: entity.description, type: 'expense' },
  })
}

export async function logExpenseUpdated(entity: { id: string; description: string; amount: number }) {
  await logAction({
    action: ACTION_MAP.expense_updated,
    description: DESCRIPTION_MAP.expense_updated,
    entityId: entity.id,
    entityType: 'expense',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: entity.description, type: 'expense' },
  })
}

export async function logExpenseApproved(entity: { id: string; description: string; amount: number; approvedBy: string }) {
  await logAction({
    action: ACTION_MAP.expense_approved,
    description: DESCRIPTION_MAP.expense_approved,
    entityId: entity.id,
    entityType: 'expense',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: entity.description, type: 'expense' },
  })
}

export async function logExpenseDeleted(entityId: string) {
  await logAction({
    action: ACTION_MAP.expense_deleted,
    description: DESCRIPTION_MAP.expense_deleted,
    entityId,
    entityType: 'expense',
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entityId, type: 'expense' },
  })
}

export async function logExpenseCategoryCreated(entity: { id: string; name: string }) {
  await logAction({
    action: ACTION_MAP.expense_category_created,
    description: DESCRIPTION_MAP.expense_category_created,
    entityId: entity.id,
    entityType: 'expense_category',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: entity.name, type: 'expense_category' },
  })
}

export async function logInvoiceCreated(entity: { id: string; invoiceNumber: string; amount: number; contactId: string }) {
  await logAction({
    action: ACTION_MAP.invoice_created,
    description: DESCRIPTION_MAP.invoice_created,
    entityId: entity.id,
    entityType: 'invoice',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: entity.invoiceNumber, type: 'invoice' },
  })
}

export async function logInvoiceUpdated(entity: { id: string; invoiceNumber: string; amount: number }) {
  await logAction({
    action: ACTION_MAP.invoice_updated,
    description: DESCRIPTION_MAP.invoice_updated,
    entityId: entity.id,
    entityType: 'invoice',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: entity.invoiceNumber, type: 'invoice' },
  })
}

export async function logInvoiceIssued(entity: { id: string; invoiceNumber: string }) {
  await logAction({
    action: ACTION_MAP.invoice_issued,
    description: DESCRIPTION_MAP.invoice_issued,
    entityId: entity.id,
    entityType: 'invoice',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: entity.invoiceNumber, type: 'invoice' },
  })
}

export async function logInvoiceVoided(entity: { id: string; invoiceNumber: string; reason?: string }) {
  await logAction({
    action: ACTION_MAP.invoice_voided,
    description: DESCRIPTION_MAP.invoice_voided,
    entityId: entity.id,
    entityType: 'invoice',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: entity.invoiceNumber, type: 'invoice' },
  })
}

export async function logInvoiceRefunded(entity: { id: string; invoiceNumber: string; amount: number }) {
  await logAction({
    action: ACTION_MAP.invoice_refunded,
    description: DESCRIPTION_MAP.invoice_refunded,
    entityId: entity.id,
    entityType: 'invoice',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: entity.invoiceNumber, type: 'invoice' },
  })
}

export async function logInvoiceDeleted(entity: { id: string; invoiceNumber: string }) {
  await logAction({
    action: ACTION_MAP.invoice_deleted,
    description: DESCRIPTION_MAP.invoice_deleted,
    entityId: entity.id,
    entityType: 'invoice',
    metadata: { before: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: entity.invoiceNumber, type: 'invoice' },
  })
}

export async function logLedgerEntryCreated(entity: { id: string; transactionNumber: string; type: string; amount: number }) {
  await logAction({
    action: ACTION_MAP.ledger_entry_created,
    description: DESCRIPTION_MAP.ledger_entry_created,
    entityId: entity.id,
    entityType: 'ledger_entry',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.id, name: entity.transactionNumber, type: 'ledger_entry' },
  })
}

export async function logSettingUpdated(entity: { key: string }) {
  await logAction({
    action: ACTION_MAP.setting_updated,
    description: DESCRIPTION_MAP.setting_updated,
    entityId: entity.key,
    entityType: 'accounting_setting',
    module: LOG_MODULES.ACCOUNTING,
    target: { id: entity.key, name: entity.key, type: 'accounting_setting' },
  })
}

export async function logReportExported(entity: { type: string; format: string }) {
  await logAction({
    action: ACTION_MAP.report_exported,
    description: DESCRIPTION_MAP.report_exported,
    entityId: `${entity.type}_${entity.format}`,
    entityType: 'report',
    metadata: { after: entity },
    module: LOG_MODULES.ACCOUNTING,
    target: { id: `${entity.type}_${entity.format}`, name: entity.type, type: 'report' },
  })
}
