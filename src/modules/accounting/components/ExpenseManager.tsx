'use client'

import { useState, useMemo, useCallback, type FormEvent } from 'react'
import { useExpenses } from '../hooks'
import { ExpenseAnalyticsCards } from './ExpenseAnalyticsCards'
import { ExpenseTable } from './ExpenseTable'
import { ExpenseGridCard } from './ExpenseGridCard'
import { ExpenseToolbar } from './ExpenseToolbar'
import { ExpenseReportSection } from './ExpenseReportSection'
import { ExpenseFormModal } from './ExpenseFormModal'
import { ToolbarViewToggle } from '@/shared/components/toolbar'
import { DeleteConfirmationDialog } from '@/shared/components/DeleteConfirmationDialog'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useLocale } from '@/i18n/components/LocaleContext'
import type { CreateExpenseInput, CreateExpenseCategoryInput } from '../types'
import {
  getExpensePeriodFilter,
  defaultPeriodValue,
  currentYearValue,
  type ExpensePeriodType,
} from '../utils/expensePeriod'

interface ExpenseManagerProps {
  t: (key: string) => string
}

export function ExpenseManager({ t }: ExpenseManagerProps) {
  const { formatCurrency } = useCurrency()
  const locale = useLocale()
  const [period, setPeriod] = useState<ExpensePeriodType | null>('month')
  const [periodValue, setPeriodValue] = useState(() => defaultPeriodValue('month'))
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCategoryId, setModalCategoryId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [categoryDeleteId, setCategoryDeleteId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'row' | 'grid'>('row')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [categorySubmitting, setCategorySubmitting] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryNameAr, setCategoryNameAr] = useState('')
  const [categoryError, setCategoryError] = useState('')

  const periodFilter = useMemo(() => getExpensePeriodFilter(period, periodValue), [period, periodValue])

  const filters = useMemo(
    () => ({
      ...periodFilter,
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    }),
    [periodFilter, fromDate, toDate],
  )

  const handlePeriodChange = useCallback((next: ExpensePeriodType | null) => {
    setPeriod(next)
    if (next === 'month') setPeriodValue(defaultPeriodValue('month'))
    if (next === 'year') setPeriodValue(currentYearValue())
  }, [])

  const periodLabel = useMemo(() => {
    if (!period || !periodValue) return ''
    if (period === 'year') return periodValue
    const [year, month] = periodValue.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }, [period, periodValue, locale])

  const { expenses, expenseCategories, create, createCategory, remove, removeCategory } = useExpenses(filters)

  const categoryNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const cat of expenseCategories) {
      map[cat.id] = cat.name
    }
    return map
  }, [expenseCategories])

  const selectedCategory = useMemo(
    () => (selectedCategoryId ? expenseCategories.find((c) => c.id === selectedCategoryId) ?? null : null),
    [selectedCategoryId, expenseCategories],
  )

  const filteredExpenses = useMemo(() => {
    if (!query) return expenses
    const lower = query.toLowerCase()
    return expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(lower) ||
        (categoryNames[e.categoryId] ?? '').toLowerCase().includes(lower),
    )
  }, [expenses, query, categoryNames])

  const categoryExpenses = useMemo(
    () => (selectedCategoryId ? filteredExpenses.filter((e) => e.categoryId === selectedCategoryId) : filteredExpenses),
    [selectedCategoryId, filteredExpenses],
  )

  const categoriesCount = useMemo(
    () => new Set(filteredExpenses.map((e) => e.categoryId)).size,
    [filteredExpenses],
  )

  const totalForMonth = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    [filteredExpenses],
  )

  const categorySummaries = useMemo(() => {
    return expenseCategories.map((cat) => {
      const catExpenses = filteredExpenses.filter((e) => e.categoryId === cat.id)
      const total = catExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
      return { id: cat.id, name: cat.name, nameAr: cat.nameAr, entries: catExpenses.length, total }
    })
  }, [expenseCategories, filteredExpenses])

  const handleCreate = useCallback(
    async (input: CreateExpenseInput) => {
      setSubmitting(true)
      try {
        await create(input)
        setModalOpen(false)
        setModalCategoryId(null)
      } catch {
        // handled by toast
      } finally {
        setSubmitting(false)
      }
    },
    [create],
  )

  const handleCreateCategory = useCallback(
    async (input: CreateExpenseCategoryInput) => {
      const category = await createCategory(input)
      return category.id
    },
    [createCategory],
  )

  const handleDelete = useCallback((id: string) => {
    setDeleteId(id)
  }, [])

  const confirmDelete = useCallback(() => {
    if (!deleteId) return
    void remove(deleteId).catch(() => undefined)
    setDeleteId(null)
  }, [deleteId, remove])

  const confirmCategoryDelete = useCallback(() => {
    if (!categoryDeleteId) return
    void removeCategory(categoryDeleteId).catch(() => undefined)
    setCategoryDeleteId(null)
  }, [categoryDeleteId, removeCategory])

  const openModalForCategory = useCallback((categoryId: string) => {
    setModalCategoryId(categoryId)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setModalCategoryId(null)
  }, [])

  const openNewCategoryModal = useCallback(() => {
    setCategoryName('')
    setCategoryNameAr('')
    setCategoryError('')
    setShowNewCategory(true)
  }, [])

  const closeNewCategoryModal = useCallback(() => {
    setShowNewCategory(false)
    setCategoryName('')
    setCategoryNameAr('')
    setCategoryError('')
  }, [])

  const submitNewCategory = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = categoryName.trim()
    if (!trimmed) {
      setCategoryError(t('common.required'))
      return
    }
    if (categorySubmitting) return
    const exists = expenseCategories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      setCategoryError(t('accounting.expenses.categoryExists'))
      return
    }
    setCategorySubmitting(true)
    try {
      const trimmedAr = categoryNameAr.trim() || undefined
      await createCategory({ name: trimmed, name_ar: trimmedAr })
      setShowNewCategory(false)
      setCategoryName('')
      setCategoryNameAr('')
      setCategoryError('')
    } catch {
      // handled by toast
    } finally {
      setCategorySubmitting(false)
    }
  }, [categoryName, categoryNameAr, categorySubmitting, expenseCategories, createCategory, t])

  const handleCategoryClick = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedCategoryId(null)
  }, [])

  // ─── Category detail view ────────────────────────────
  if (selectedCategoryId && selectedCategory) {
    const catTotal = categoryExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const displayExpenses = selectedCategoryId ? categoryExpenses : filteredExpenses

    return (
      <div className="space-y-6">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm text-[#787774] hover:text-[#1A1A1A] transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {t('common.back')}
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#1A1A1A]">{selectedCategory.name}</h2>
            {selectedCategory.nameAr ? (
              <p className="mt-0.5 text-sm text-[#787774]" dir="rtl">{selectedCategory.nameAr}</p>
            ) : null}
            <p className="mt-1 text-sm font-medium text-[#787774]">
              {categoryExpenses.length} {t('accounting.expenses.analyticsEntries')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white px-4 py-2">
              <span className="text-xs text-[#787774]">{t('accounting.expenses.analyticsTotal')}:</span>
              <span className="text-sm font-bold">{formatCurrency(catTotal)}</span>
            </div>
            <button
              type="button"
              onClick={() => openModalForCategory(selectedCategoryId)}
              className="h-9 rounded-lg bg-[#1A1A1A] px-4 text-sm font-medium text-white transition-all duration-200 hover:bg-[#333333]"
            >
              + {t('accounting.expenses.addNew')}
            </button>
          </div>
        </div>

        <ExpenseToolbar
          period={period}
          periodValue={periodValue}
          fromDate={fromDate}
          toDate={toDate}
          query={query}
          expenses={displayExpenses}
          categoryNames={categoryNames}
          t={t}
          onPeriodChange={handlePeriodChange}
          onPeriodValueChange={setPeriodValue}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onQueryChange={setQuery}
        />

        {viewMode === 'row' ? (
          <ExpenseTable
            expenses={displayExpenses}
            categoryNames={categoryNames}
            loading={false}
            t={t}
            onDelete={handleDelete}
            hideCategory
          />
        ) : (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {displayExpenses.map((expense) => (
              <ExpenseGridCard
                key={expense.id}
                expense={expense}
                categoryName={categoryNames[expense.categoryId] ?? expense.categoryId}
                t={t}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {modalOpen ? (
          <ExpenseFormModal
            categories={expenseCategories}
            saving={submitting}
            t={t}
            initialCategoryId={modalCategoryId ?? undefined}
            onClose={closeModal}
            onSubmit={handleCreate}
            onCreateCategory={handleCreateCategory}
          />
        ) : null}

        <DeleteConfirmationDialog
          isOpen={Boolean(deleteId)}
          title={t('accounting.expenses.confirmDeleteTitle')}
          description={t('accounting.expenses.confirmDeleteDescription')}
          cancelLabel={t('common.cancel')}
          confirmLabel={t('accounting.expenses.confirmDeleteAction')}
          onClose={() => setDeleteId(null)}
          onConfirm={confirmDelete}
        />
      </div>
    )
  }

  // ─── Overview (all categories) ────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#1A1A1A]">{t('accounting.expenses.expenseTitle')}</h2>
          <p className="mt-1 text-sm font-medium text-[#787774]">{t('accounting.expenses.expenseSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <ToolbarViewToggle
            view={viewMode}
            onChange={setViewMode}
            rowLabel={t('accounting.expenses.rowView')}
            gridLabel={t('accounting.expenses.gridView')}
          />
          <button
            type="button"
            onClick={openNewCategoryModal}
            className="h-9 rounded-lg bg-[#1A1A1A] px-4 text-sm font-medium text-white transition-all duration-200 hover:bg-[#333333]"
          >
            {t('accounting.expenses.addCategory')}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[#EAEAEA] bg-white p-4 sm:flex-row sm:items-center">
        <input
          type="month"
          value={periodValue ?? ''}
          onChange={(e) => {
            if (e.target.value) {
              setPeriodValue(e.target.value)
              setPeriod('month')
            } else {
              setPeriod(null)
              setPeriodValue('')
            }
          }}
          className="h-10 rounded-lg border border-[#D4D4D4] px-3 text-sm text-[#333333]"
        />
        {periodLabel && (
          <span className="text-sm font-medium text-[#787774]">{periodLabel}</span>
        )}
      </div>

      <ExpenseAnalyticsCards
        total={totalForMonth}
        entriesCount={filteredExpenses.length}
        categoriesCount={categoriesCount}
        t={t}
      />

      <ExpenseReportSection
        expenses={filteredExpenses}
        categoryNames={categoryNames}
        periodLabel={periodLabel}
        t={t}
      />

      {viewMode === 'row' ? (
        <div className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white">
          <table className="w-full">
              <thead>
                <tr className="border-b border-[#EAEAEA] text-left text-xs font-semibold uppercase tracking-wider text-[#787774]">
                  <th className="px-4 py-3">{t('accounting.expenses.category')}</th>
                  <th className="px-4 py-3">العربية</th>
                  <th className="px-4 py-3 text-right">{t('accounting.expenses.analyticsEntries')}</th>
                  <th className="px-4 py-3 text-right">{t('accounting.expenses.analyticsTotal')}</th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
            <tbody>
              {categorySummaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-[#787774]">
                    {t('accounting.expenses.noCategories')}
                  </td>
                </tr>
              ) : (
                categorySummaries.map((cat) => (
                  <tr
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className="cursor-pointer border-b border-gray-50 transition-colors last:border-0 hover:bg-[#F9F9F8]"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-800">
                        {cat.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {cat.nameAr ? (
                        <span className="text-sm text-[#555555]" dir="rtl">{cat.nameAr}</span>
                      ) : (
                        <span className="text-sm text-[#BBBBBB]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[#555555]">{cat.entries}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-[#1A1A1A]">{formatCurrency(cat.total)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCategoryDeleteId(cat.id) }}
                        className="text-[#BBBBBB] transition-colors hover:text-[#9F2F2D]"
                        title={t('common.delete')}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categorySummaries.length === 0 ? (
            <div className="col-span-full py-12 text-center text-sm text-[#787774]">
              {t('accounting.expenses.noCategories')}
            </div>
          ) : (
            categorySummaries.map((cat) => (
              <div
                key={cat.id}
                className="group relative rounded-xl border border-[#EAEAEA] bg-white p-5 transition-all hover:border-[#D4D4D4] hover:"
              >
                <div
                  onClick={() => handleCategoryClick(cat.id)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-800">
                      {cat.name}
                    </span>
                    <span className="text-xs font-semibold text-[#787774]">{cat.entries} {t('accounting.expenses.analyticsEntries')}</span>
                  </div>
                  {cat.nameAr ? (
                    <p className="mt-1 text-xs text-[#787774]" dir="rtl">{cat.nameAr}</p>
                  ) : null}
                  <p className="mt-3 text-lg font-bold text-[#1A1A1A]">{formatCurrency(cat.total)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCategoryDeleteId(cat.id)}
                  className="absolute right-2 top-2 rounded-lg p-1.5 text-[#BBBBBB] opacity-0 transition-all hover:bg-[#FDEBEC] hover:text-[#9F2F2D] group-hover:opacity-100"
                  title={t('common.delete')}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {showNewCategory ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 px-4 py-6"
          onClick={(e) => { if (e.target === e.currentTarget) closeNewCategoryModal() }}
        >
          <form onSubmit={submitNewCategory} className="w-full max-w-md rounded-xl bg-white p-6">
            <h2 className="text-base font-bold text-[#1A1A1A]">{t('accounting.expenses.newCategoryTitle')}</h2>
            <p className="mt-1 text-sm text-[#787774]">{t('accounting.expenses.newCategoryDescription')}</p>

            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#333333]">
                  {t('accounting.expenses.categoryLabel')} (English)
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => { setCategoryName(e.target.value); setCategoryError('') }}
                  className="h-10 w-full rounded-xl border border-[#EAEAEA] bg-white px-3 text-sm text-[#1A1A1A] outline-none ring-0 transition-all duration-100 focus:border-gray-400"
                  placeholder={t('accounting.expenses.categoryPlaceholder')}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#333333]">
                  {t('accounting.expenses.categoryLabel')} (العربية)
                </label>
                <input
                  type="text"
                  value={categoryNameAr}
                  onChange={(e) => { setCategoryNameAr(e.target.value); setCategoryError('') }}
                  className="h-10 w-full rounded-xl border border-[#EAEAEA] bg-white px-3 text-sm text-[#1A1A1A] outline-none ring-0 transition-all duration-100 focus:border-gray-400"
                  placeholder="اسم الفئة"
                  dir="rtl"
                />
              </div>
              {categoryError ? (
                <p className="text-xs text-[#9F2F2D]">{categoryError}</p>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeNewCategoryModal}
                disabled={categorySubmitting}
                className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-bold text-[#333333] transition-all duration-200 hover:bg-[#F9F9F8] disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={categorySubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1A1A1A] px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:bg-[#333333] disabled:opacity-60"
              >
                {categorySubmitting && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {categorySubmitting ? t('common.saving') : t('common.create')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <DeleteConfirmationDialog
        isOpen={Boolean(deleteId)}
        title={t('accounting.expenses.confirmDeleteTitle')}
        description={t('accounting.expenses.confirmDeleteDescription')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('accounting.expenses.confirmDeleteAction')}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      <DeleteConfirmationDialog
        isOpen={Boolean(categoryDeleteId)}
        title={t('accounting.expenses.confirmCategoryDeleteTitle')}
        description={t('accounting.expenses.confirmCategoryDeleteDescription')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('accounting.expenses.confirmDeleteAction')}
        onClose={() => setCategoryDeleteId(null)}
        onConfirm={confirmCategoryDelete}
      />
    </div>
  )
}
