'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useLocale } from '@/i18n/components/LocaleContext'
import { useAdminRooms } from '../hooks'
import { useRoomTypes } from '@/modules/room-types/hooks'
import type { Room, CreateRoomInput, UpdateRoomInput } from '../types'

export function RoomsTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const locale = useLocale()
  const { items, loading, error, create, update, remove } = useAdminRooms()
  const { items: roomTypes } = useRoomTypes()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateRoomInput>({
    number: '',
    floor: 1,
    room_type_id: '',
    status: 'available',
    price: 0,
    capacity: 2,
    amenities: [],
  })

  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm({ number: '', floor: 1, room_type_id: '', status: 'available', price: 0, capacity: 2, amenities: [] })
  }, [])

  const handleEdit = useCallback((item: Room) => {
    setEditingId(item.id)
    setForm({
      number: item.number,
      floor: item.floor,
      room_type_id: item.roomTypeId,
      status: item.status,
      price: item.price,
      capacity: item.capacity,
      amenities: item.amenities,
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingId) {
        await update(editingId, form as UpdateRoomInput)
      } else {
        await create(form)
      }
      resetForm()
    } catch { /* handled */ }
    finally { setSubmitting(false) }
  }, [editingId, form, create, update, resetForm])

  if (loading) return <div className="p-4 text-[#787774]">{t('rooms.loadingRooms')}</div>
  if (error) return <div className="p-4 text-[#9F2F2D]">{error}</div>

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5  space-y-4">
        <h3 className="text-lg font-semibold">{editingId ? t('rooms.editRoom') : t('rooms.addRoom')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('rooms.roomNumber')}</label>
            <input
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.number}
              onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('rooms.floor')}</label>
            <input
              type="number" inputMode="numeric" step={1} onWheel={(event) => event.currentTarget.blur()}
              min={0}
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.floor}
              onChange={e => setForm(f => ({ ...f, floor: Number(e.target.value) }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('rooms.type')}</label>
            <select
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.room_type_id}
              onChange={e => {
                const roomTypeId = e.target.value
                const roomType = roomTypes.find(rt => rt.id === roomTypeId)
                setForm(f => ({
                  ...f,
                  room_type_id: roomTypeId,
                  capacity: roomType?.defaultCapacity ?? f.capacity,
                }))
              }}
              required
            >
              <option value="">{t('rooms.selectType')}</option>
              {roomTypes.map(rt => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('rooms.price')}</label>
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
            <label className="block text-sm font-medium text-[#333333]">{t('rooms.capacity')}</label>
            <input
              type="number" inputMode="numeric" step={1} onWheel={(event) => event.currentTarget.blur()}
              min={1}
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.capacity}
              onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333333]">{t('rooms.status')}</label>
            <select
              className="mt-1 block w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as Room['status'] }))}
            >
              <option value="available">{t('rooms.available')}</option>
              <option value="occupied">{t('rooms.occupied')}</option>
              <option value="maintenance">{t('rooms.maintenance')}</option>
              <option value="cleaning">{t('rooms.cleaning')}</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? (editingId ? t('rooms.updating') : t('rooms.creating')) : (editingId ? t('common.save') : t('common.create'))}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-[#D4D4D4] px-4 py-2 text-sm font-medium text-[#333333] hover:bg-[#F9F9F8]">
              {t('common.cancel')}
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-xl  overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#EAEAEA]">
              <th className="text-left px-4 py-3 font-medium text-[#787774]">{t('rooms.roomNumber')}</th>
              <th className="text-left px-4 py-3 font-medium text-[#787774]">{t('rooms.floor')}</th>
              <th className="text-left px-4 py-3 font-medium text-[#787774]">{t('rooms.type')}</th>
              <th className="text-center px-4 py-3 font-medium text-[#787774]">{t('rooms.status')}</th>
              <th className="text-right px-4 py-3 font-medium text-[#787774]">{t('rooms.price')}</th>
              <th className="text-center px-4 py-3 font-medium text-[#787774]">{t('rooms.capacity')}</th>
              <th className="text-right px-4 py-3 font-medium text-[#787774]">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-[#F9F9F8]">
                <td className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/rooms/${item.id}`)}
                    className="text-[#346538] underline-offset-2 transition-colors hover:underline"
                  >
                    {item.number}
                  </button>
                </td>
                <td className="px-4 py-3 text-[#787774]">{item.floor}</td>
                <td className="px-4 py-3 text-[#787774]">
                  {roomTypes.find(rt => rt.id === item.roomTypeId)?.name ?? item.roomTypeId}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.status === 'available' ? 'bg-green-100 text-green-700' :
                    item.status === 'occupied' ? 'bg-blue-100 text-blue-700' :
                    item.status === 'maintenance' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-[#F5F5F5] text-[#333333]'
                  }`}>{item.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {(() => {
                    const roomType = roomTypes.find(rt => rt.id === item.roomTypeId)
                    const effectivePrice = item.price || roomType?.basePrice || 0
                    const isInherited = !item.price
                    return <>{effectivePrice.toFixed(2)}{isInherited && <span className="ml-1 text-xs text-[#787774]">{t('rooms.fromType')}</span>}</>
                  })()}
                </td>
                <td className="px-4 py-3 text-center">{item.capacity}</td>
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
