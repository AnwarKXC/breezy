'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { FloatingInput, FloatingSelect } from '@/shared/components/FloatingField'
import type { ExpenseCategory, CreateExpenseInput, CreateExpenseCategoryInput } from '../types'

const NEW_CATEGORY_VALUE = '__new__'

interface ExpenseFormModalProps {
  categories: ExpenseCategory[]
  saving: boolean
  t: (key: string) => string
  initialCategoryId?: string
  onClose: () => void
  onSubmit: (input: CreateExpenseInput) => Promise<void>
  onCreateCategory: (input: CreateExpenseCategoryInput) => Promise<string>
}

function CreateCategoryModal({
  t,
  existingNames,
  onClose,
  onCreated,
  onCreateCategory,
}: {
  t: (key: string) => string
  existingNames: Set<string>
  onClose: () => void
  onCreated: (id: string) => void
  onCreateCategory: (input: CreateExpenseCategoryInput) => Promise<string>
}) {
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || creating) return
    const trimmed = name.trim()
    if (existingNames.has(trimmed.toLowerCase())) {
      setError(t('accounting.expenses.categoryExists'))
      return
    }
    setError('')
    setCreating(true)
    try {
      const trimmedAr = nameAr.trim() || undefined
      const id = await onCreateCategory({ name: trimmed, name_ar: trimmedAr })
      onCreated(id)
    } catch {
      // handled by toast
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 px-4 py-6"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <form
        className="w-full max-w-md rounded-xl bg-white p-6 "
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-bold text-[#1A1A1A]">{t('accounting.expenses.createNewCategory')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#F5F5F5] px-3 py-1 text-sm text-[#555555] transition-all duration-200 hover:bg-[#EAEAEA]"
          >
            {t('common.close')}
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <FloatingInput
            autoFocus
            required
            label={`${t('accounting.expenses.newCategoryName')} (English)`}
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
          />
          <FloatingInput
            label={`${t('accounting.expenses.newCategoryName')} (العربية)`}
            value={nameAr}
            onChange={(e) => { setNameAr(e.target.value); setError('') }}
            inputMode="text"
          />
          {error && <p className="mt-1 text-xs text-[#9F2F2D]">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#F5F5F5] px-4 py-2 text-sm font-bold text-[#555555] transition-all duration-200 hover:bg-[#EAEAEA]"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="rounded-xl bg-[#1A1A1A] px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? t('common.saving') : t('common.create')}
          </button>
        </div>
      </form>
    </div>
  )
}

export function ExpenseFormModal({ categories, saving, t, initialCategoryId, onClose, onSubmit, onCreateCategory }: ExpenseFormModalProps) {
  const now = new Date()
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? '')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(now.toISOString().slice(0, 10))
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const existingCategoryNames = useMemo(
    () => new Set(categories.map((c) => c.name.toLowerCase())),
    [categories],
  )

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === NEW_CATEGORY_VALUE) {
      setShowCategoryModal(true)
      e.target.value = categoryId
    } else {
      setCategoryId(e.target.value)
    }
  }

  const handleCategoryCreated = (newId: string) => {
    setCategoryId(newId)
    setShowCategoryModal(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving || !categoryId || !amount) return
    await onSubmit({
      category_id: categoryId,
      amount: Number(amount),
      description,
      date,
    })
    setAmount('')
    setDescription('')
    setCategoryId('')
    setDate(now.toISOString().slice(0, 10))
  }

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 px-4 py-6"
        onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      >
        <form
          className="w-full max-w-xl rounded-xl bg-white p-6 "
          onSubmit={handleSubmit}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#1A1A1A]">{t('accounting.expenses.addNewTitle')}</h2>
              <p className="mt-1 text-sm text-[#787774]">{t('accounting.expenses.addNewDescription')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#F5F5F5] px-3 py-1 text-sm text-[#555555] transition-all duration-200 hover:bg-[#EAEAEA]"
            >
              {t('common.close')}
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {initialCategoryId ? (
              <div className="sm:col-span-2 rounded-lg border border-[#EAEAEA] bg-[#F9F9F8] px-4 py-3 text-sm text-[#333333]">
                <span className="text-xs font-medium text-[#787774]">{t('accounting.expenses.category')}: </span>
                {categories.find((c) => c.id === initialCategoryId)?.name ?? initialCategoryId}
              </div>
            ) : (
              <FloatingSelect
                required
                label={t('accounting.expenses.category')}
                value={categoryId}
                onChange={handleCategoryChange}
              >
                <option value="">{t('accounting.expenses.selectCategory')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
                <option value={NEW_CATEGORY_VALUE}>+ {t('accounting.expenses.createNewCategory')}</option>
              </FloatingSelect>
            )}

            <FloatingInput
              required
              type="number"
              step="0.01"
              min="0.01"
              label={t('accounting.expenses.amount')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <FloatingInput
              required
              type="text"
              label={t('accounting.expenses.description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <FloatingInput
              required
              type="date"
              label={t('accounting.expenses.date')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#F5F5F5] px-4 py-2 text-sm font-bold text-[#555555] transition-all duration-200 hover:bg-[#EAEAEA]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#1A1A1A] px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>

      {showCategoryModal ? (
        <CreateCategoryModal
          t={t}
          existingNames={existingCategoryNames}
          onClose={() => setShowCategoryModal(false)}
          onCreated={handleCategoryCreated}
          onCreateCategory={onCreateCategory}
        />
      ) : null}
    </>
  )
}
