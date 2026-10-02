'use client'

import { useState, useCallback } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { usePricing } from '../hooks'
import { useRoomTypes } from '@/modules/room-types/hooks'
import type { CreatePricingInput } from '../types'
import type { RoomTypePricing } from '../types'

export function PricingTab() {
  const { t } = useTranslation()
  const { items, loading, error, create, update, remove } = usePricing()
  const { items: roomTypes } = useRoomTypes()
  const { formatCurrency } = useCurrency()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreatePricingInput>({
    room_type_id: '',
    price: 0,
    currency: 'EGP',
    effective_from: null,
    effective_until: null,
  })

  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm({ room_type_id: '', price: 0, currency: 'EGP', effective_from: null, effective_until: null })
  }, [])

  const handleEdit = useCallback((item: RoomTypePricing) => {
    setEditingId(item.id)
    setForm({
      room_type_id: item.roomTypeId,
      price: item.price,
      currency: item.currency,
      effective_from: item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : '',
      effective_until: item.effectiveUntil ? item.effectiveUntil.slice(0, 10) : '',
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
    } catch { /* handled */ }
    finally { setSubmitting(false) }
  }, [editingId, form, create, update, resetForm])

  const getTypeName = useCallback((typeId: string) => {
    return roomTypes.find(rt => rt.id === typeId)?.name ?? typeId
  }, [roomTypes])

  if (loading) return <div className="p-4 text-[#787774]">{t('rooms.loadingPricing')}</div>
  if (error) return <div className="p-4 text-[#9F2F2D]">{error}</div>

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5  space-y-4">
        <h3 className="text-lg font-semibold">{editingId ? t('accounting.pricing.edit') : t('accounting.pricing.add')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('accounting.pricing.roomType')}</label>
            <select
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.room_type_id}
              onChange={e => setForm(f => ({ ...f, room_type_id: e.target.value }))}
              required
            >
              <option value="">{t('accounting.pricing.selectType')}</option>
              {roomTypes.map(rt => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('accounting.pricing.price')}</label>
            <input
              type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
              min={0}
              step="0.01"
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('accounting.pricing.effectiveFrom')}</label>
            <input
              type="date" max={form.effective_until || undefined}
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.effective_from ?? ''}
              onChange={e => setForm(f => ({ ...f, effective_from: e.target.value || null }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('accounting.pricing.effectiveUntil')}</label>
            <input
              type="date" min={form.effective_from || undefined}
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.effective_until ?? ''}
              onChange={e => setForm(f => ({ ...f, effective_until: e.target.value || null }))}
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
              <th className="text-left px-4 py-3 font-medium text-[#787774]">{t('accounting.pricing.roomType')}</th>
              <th className="text-right px-4 py-3 font-medium text-[#787774]">{t('accounting.pricing.price')}</th>
              <th className="text-left px-4 py-3 font-medium text-[#787774]">{t('accounting.pricing.currency')}</th>
              <th className="text-left px-4 py-3 font-medium text-[#787774]">{t('accounting.pricing.effective')}</th>
              <th className="text-right px-4 py-3 font-medium text-[#787774]">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-accent/10">
                <td className="px-4 py-3 font-medium">{getTypeName(item.roomTypeId)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(item.price)}</td>
                <td className="px-4 py-3 text-[#787774]">{item.currency}</td>
                <td className="px-4 py-3 text-[#787774] text-sm">
                  {item.effectiveFrom ? `${item.effectiveFrom.slice(0, 10)}` : t('accounting.pricing.current')}
                  {item.effectiveUntil ? ` — ${item.effectiveUntil.slice(0, 10)}` : ''}
                </td>
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
