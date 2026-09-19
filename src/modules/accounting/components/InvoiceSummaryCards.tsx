'use client'

import { useMemo, useState, useEffect } from 'react'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { Invoice, Payment } from '../types'

interface Props {
  invoices: Invoice[]
  t: (key: string) => string
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function getNowMs(): number {
  return Date.now()
}

export function InvoiceSummaryCards({ invoices, t }: Props) {
  const { formatCurrency } = useCurrency()
  const [now, setNow] = useState(() => getNowMs())
  const [todaysPayments, setTodaysPayments] = useState<Payment[]>([])

  useEffect(() => {
    const id = setInterval(() => setNow(getNowMs()), 60000)
    return () => clearInterval(id)
  }, [])

  const today = useMemo(() => getTodayStr(), [])

  // Cash view: "Paid Today" is real money received today minus refunds
  // issued today, read from payment transactions — not derived from invoice
  // status, which a later refund would otherwise erase.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/accounting/payments?fromDate=${today}&toDate=${today}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j) setTodaysPayments((j.data ?? []) as Payment[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [today])

  const stats = useMemo(() => {
    const total = invoices.length
    const draft = invoices.filter((i) => i.status === 'draft').length
    const issued = invoices.filter((i) => i.status === 'issued').length
    const paid = invoices.filter((i) => i.status === 'paid').length
    const partial = invoices.filter((i) => i.status === 'partially_paid').length
    const overdue = invoices.filter((i) => i.status === 'overdue').length
    const voided = invoices.filter((i) => i.status === 'void').length
    const refunded = invoices.filter((i) => i.status === 'refunded').length

    const outstandingBalance = invoices
      .filter((i) => i.status !== 'void' && i.status !== 'refunded')
      .reduce((sum, i) => sum + i.remainingBalance, 0)

    const paidToday = todaysPayments.reduce(
      (sum, p) => sum + Number(p.amount ?? 0),
      0,
    )

    const refundedTotal = invoices.reduce((sum, i) => sum + i.refundedAmount, 0)

    const dueSoon = invoices.filter((i) => {
      if (i.status === 'paid' || i.status === 'void' || i.status === 'refunded') return false
      if (!i.dueDate) return false
      const diff = new Date(i.dueDate).getTime() - now
      return diff > 0 && diff <= 3 * 86400000
    }).length

    return { total, draft, issued, paid, partial, overdue, voided, refunded, outstandingBalance, paidToday, refundedTotal, dueSoon }
  }, [invoices, todaysPayments, now])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
        <p className="text-xs font-medium text-[#787774]">{t('accounting.invoices.summary.totalInvoices')}</p>
        <p className="mt-1 text-2xl font-semibold text-[#1A1A1A]">{stats.total}</p>
      </div>
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
        <p className="text-xs font-medium text-[#787774]">{t('accounting.invoices.summary.outstandingBalance')}</p>
        <p className="mt-1 text-2xl font-semibold text-amber-600">{formatCurrency(stats.outstandingBalance)}</p>
      </div>
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
        <p className="text-xs font-medium text-[#787774]">{t('accounting.invoices.summary.paidToday')}</p>
        <p className="mt-1 text-2xl font-semibold text-[#346538]">{formatCurrency(stats.paidToday)}</p>
      </div>
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
        <p className="text-xs font-medium text-[#787774]">{t('accounting.invoices.summary.dueSoon')}</p>
        <p className="mt-1 text-2xl font-semibold text-rose-600">{stats.dueSoon}</p>
      </div>
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
        <p className="text-xs font-medium text-[#787774]">{t('accounting.invoices.summary.draft')}</p>
        <p className="mt-1 text-2xl font-semibold text-[#787774]">{stats.draft}</p>
      </div>
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
        <p className="text-xs font-medium text-[#787774]">{t('accounting.invoices.summary.refundedAmount')}</p>
        <p className="mt-1 text-2xl font-semibold text-[#9F2F2D]">{formatCurrency(stats.refundedTotal)}</p>
      </div>
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
        <p className="text-xs font-medium text-[#787774]">{t('accounting.invoices.summary.paid')}</p>
        <p className="mt-1 text-2xl font-semibold text-[#346538]">{stats.paid}</p>
      </div>
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
        <p className="text-xs font-medium text-[#787774]">{t('accounting.invoices.summary.partial')}</p>
        <p className="mt-1 text-2xl font-semibold text-amber-500">{stats.partial}</p>
      </div>
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
        <p className="text-xs font-medium text-[#787774]">{t('accounting.invoices.summary.overdue')}</p>
        <p className="mt-1 text-2xl font-semibold text-[#9F2F2D]">{stats.overdue}</p>
      </div>
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
        <p className="text-xs font-medium text-[#787774]">{t('accounting.invoices.summary.voided')}</p>
        <p className="mt-1 text-2xl font-semibold text-[#787774]">{stats.voided}</p>
      </div>
    </div>
  )
}
