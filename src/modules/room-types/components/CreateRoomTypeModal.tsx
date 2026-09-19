'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { Modal } from '@/shared/components/Modal'
import { FloatingInput } from '@/shared/components/FloatingField'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useRoomTypes } from '../hooks/useRoomTypes'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreateRoomTypeModal({ isOpen, onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const { create } = useRoomTypes()
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState(2)
  const [saving, setSaving] = useState(false)

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await create({ name: name.trim(), slug: name.trim().toLowerCase().replace(/\s+/g, '-'), base_price: 0, default_capacity: capacity })
      onCreated()
    } catch {
      // handled by hook
    } finally {
      setSaving(false)
    }
  }, [name, capacity, create, onCreated])

  const handleClose = useCallback(() => {
    if (!saving) onClose()
  }, [saving, onClose])

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('rooms.addRoomType')} size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-[15px]">
          <div className="sm:col-span-2">
            <FloatingInput required value={name} onChange={e => setName(e.target.value)} label={t('common.name')} />
          </div>
          <FloatingInput type="number" min={1} value={capacity} onChange={e => setCapacity(Number(e.target.value))} label={t('rooms.defaultCapacity')} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={handleClose} className="rounded-lg border border-[#D4D4D4] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#F9F9F8] transition-colors">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={saving || !name.trim()} className="rounded-lg bg-[#1A1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? t('rooms.creating') : t('common.create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
