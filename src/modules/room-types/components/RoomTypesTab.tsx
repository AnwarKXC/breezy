'use client'

import { useState, useCallback } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useRoomTypes } from '../hooks'
import type { RoomType, CreateRoomTypeInput } from '../types'

export function RoomTypesTab() {
  const { t } = useTranslation()
  const { items, loading, error, create, update, remove } = useRoomTypes()
  const { formatCurrency } = useCurrency()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateRoomTypeInput>({
    name: '',
    slug: '',
    description: null,
    base_price: 0,
    default_capacity: 2,
    amenities: [],
  })

  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm({ name: '', slug: '', description: null, base_price: 0, default_capacity: 2, amenities: [] })
  }, [])

  const handleEdit = useCallback((item: RoomType) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description,
      base_price: item.basePrice,
      default_capacity: item.defaultCapacity,
      amenities: item.amenities,
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingId) {
        await update(editingId, form)
      } else {
        await create(form)
      }
      resetForm()
    } catch {
      // error handled in hook
    } finally {
      setSubmitting(false)
    }
  }, [editingId, form, create, update, resetForm])

  if (loading) return <div className="p-4 text-[#787774]">{t('rooms.loadingRoomTypes')}</div>
  if (error) return <div className="p-4 text-[#9F2F2D]">{error}</div>

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5  space-y-4">
        <h3 className="text-lg font-semibold">{editingId ? t('rooms.editRoomType') : t('rooms.addRoomType')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('common.name')}</label>
            <input
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('rooms.slug')}</label>
            <input
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('rooms.basePrice')}</label>
            <input
              type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
              min={0}
              step="0.01"
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.base_price}
              onChange={e => setForm(f => ({ ...f, base_price: Number(e.target.value) }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('rooms.defaultCapacity')}</label>
            <input
              type="number" inputMode="numeric" step={1} onWheel={(event) => event.currentTarget.blur()}
              min={1}
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.default_capacity}
              onChange={e => setForm(f => ({ ...f, default_capacity: Number(e.target.value) }))}
              required
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-[#333333]">{t('common.description')}</label>
            <textarea
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))}
              rows={2}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? (editingId ? t('rooms.updating') : t('rooms.creating')) : (editingId ? t('common.save') : t('common.create'))}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-[#D4D4D4] px-4 py-2 text-sm font-medium text-[#333333] hover:bg-accent/10">
              {t('common.cancel')}
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-xl  overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#EAEAEA]">
              <th className="text-left px-4 py-3 font-medium text-[#787774]">{t('common.name')}</th>
              <th className="text-left px-4 py-3 font-medium text-[#787774]">{t('rooms.slug')}</th>
              <th className="text-right px-4 py-3 font-medium text-[#787774]">{t('rooms.basePrice')}</th>
              <th className="text-center px-4 py-3 font-medium text-[#787774]">{t('rooms.capacity')}</th>
              <th className="text-right px-4 py-3 font-medium text-[#787774]">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-accent/10">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-[#787774]">{item.slug}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(item.basePrice)}</td>
                <td className="px-4 py-3 text-center">{item.defaultCapacity}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(item)} className="text-[#1A1A1A] hover:text-blue-800 mr-3">{t('common.edit')}</button>
                  <button onClick={() => { setDeletingId(item.id); void remove(item.id).finally(() => setDeletingId(null)) }} disabled={deletingId === item.id} className="text-[#9F2F2D] hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed">{deletingId === item.id ? t('rooms.deleting') : t('common.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
