import 'server-only'

import { ACTIONS, canPerformAction } from '@/config/rbac'
import {
  AuthAccessError,
  getCurrentServerSession,
  type VerifiedSession,
} from '@/services/auth/serverSession'

async function requireActionPermission(action: (typeof ACTIONS)[keyof typeof ACTIONS]) {
  const session = await getCurrentServerSession()

  if (!canPerformAction(session.role, action)) {
    throw new AuthAccessError('auth/permission_denied')
  }

  return session
}

export function requireAccountingRead() {
  return requireActionPermission(ACTIONS.ACCOUNTING_READ)
}

export function requireAccountingWrite() {
  return requireActionPermission(ACTIONS.ACCOUNTING_WRITE)
}

export function requireAccountingReports() {
  return requireActionPermission(ACTIONS.ACCOUNTING_REPORTS)
}

export function requireAccountingExport() {
  return requireActionPermission(ACTIONS.ACCOUNTING_EXPORT)
}

export function requireInvoicesCreate() {
  return requireActionPermission(ACTIONS.INVOICES_CREATE)
}

export function requireInvoicesUpdate() {
  return requireActionPermission(ACTIONS.INVOICES_UPDATE)
}

export function requireInvoicesIssue() {
  return requireActionPermission(ACTIONS.INVOICES_ISSUE)
}

export function requireInvoicesVoid() {
  return requireActionPermission(ACTIONS.INVOICES_VOID)
}

export function requireInvoicesRefund() {
  return requireActionPermission(ACTIONS.INVOICES_REFUND)
}

export function requireInvoicesAdjust() {
  return requireActionPermission(ACTIONS.INVOICES_ADJUST)
}

export function requireInvoicesDelete() {
  return requireActionPermission(ACTIONS.INVOICES_DELETE)
}

export function requirePaymentsCreate() {
  return requireActionPermission(ACTIONS.PAYMENTS_CREATE)
}

export function requirePaymentsRefund() {
  return requireActionPermission(ACTIONS.PAYMENTS_REFUND)
}

export function requireExpensesCreate() {
  return requireActionPermission(ACTIONS.EXPENSES_CREATE)
}

export function requireExpensesUpdate() {
  return requireActionPermission(ACTIONS.EXPENSES_UPDATE)
}

export function requireExpensesApprove() {
  return requireActionPermission(ACTIONS.EXPENSES_APPROVE)
}

export function requireExpensesVoid() {
  return requireActionPermission(ACTIONS.EXPENSES_VOID)
}

export function requireLedgerRead() {
  return requireActionPermission(ACTIONS.LEDGER_READ)
}

export function requireAccountingSettings() {
  return requireActionPermission(ACTIONS.ACCOUNTING_SETTINGS)
}

export function getAccountingUiPermissions(session: VerifiedSession) {
  return {
    canReadAccounting: canPerformAction(session.role, ACTIONS.ACCOUNTING_READ),
    canWriteAccounting: canPerformAction(session.role, ACTIONS.ACCOUNTING_WRITE),
    canViewReports: canPerformAction(session.role, ACTIONS.ACCOUNTING_REPORTS),
    canExport: canPerformAction(session.role, ACTIONS.ACCOUNTING_EXPORT),
    canCreateInvoices: canPerformAction(session.role, ACTIONS.INVOICES_CREATE),
    canUpdateInvoices: canPerformAction(session.role, ACTIONS.INVOICES_UPDATE),
    canIssueInvoices: canPerformAction(session.role, ACTIONS.INVOICES_ISSUE),
    canVoidInvoices: canPerformAction(session.role, ACTIONS.INVOICES_VOID),
    canRefundInvoices: canPerformAction(session.role, ACTIONS.INVOICES_REFUND),
    canAdjustInvoices: canPerformAction(session.role, ACTIONS.INVOICES_ADJUST),
    canCreatePayments: canPerformAction(session.role, ACTIONS.PAYMENTS_CREATE),
    canRefundPayments: canPerformAction(session.role, ACTIONS.PAYMENTS_REFUND),
    canCreateExpenses: canPerformAction(session.role, ACTIONS.EXPENSES_CREATE),
    canUpdateExpenses: canPerformAction(session.role, ACTIONS.EXPENSES_UPDATE),
    canApproveExpenses: canPerformAction(session.role, ACTIONS.EXPENSES_APPROVE),
    canVoidExpenses: canPerformAction(session.role, ACTIONS.EXPENSES_VOID),
    canReadLedger: canPerformAction(session.role, ACTIONS.LEDGER_READ),
    canManageSettings: canPerformAction(session.role, ACTIONS.ACCOUNTING_SETTINGS),
  }
}
