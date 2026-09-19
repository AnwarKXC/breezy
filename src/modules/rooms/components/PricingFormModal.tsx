'use client'

import { Modal, DropdownSelect, FloatingInput, type CurrencyCode, CURRENCY_LABELS } from '@/shared'
import type { RoomType } from '@/modules/room-types/types'

const currencyOptions = (Object.keys(CURRENCY_LABELS) as CurrencyCode[]).map(code => ({
 label: CURRENCY_LABELS[code],
 value: code,
}))

interface PricingFormModalProps {
 isOpen: boolean
 onClose: () => void
 editingId: string | null
 form: {
 room_type_id: string
 price: number
 currency: CurrencyCode
 effective_from: string
 effective_until: string
 }
 onFormChange: (form: Partial<PricingFormModalProps['form']>) => void
 roomTypes: {
 items: RoomType[]
 }
 error: string
  onSave: () => Promise<void>; t: (key: string) => string
 saving?: boolean
}

export function PricingFormModal({
  isOpen,
  onClose,
  editingId,
  form,
  onFormChange,
  roomTypes,
  error,
  onSave,
  t,
  saving,
}: PricingFormModalProps) {
 return (
 <Modal
 isOpen={isOpen}
  onClose={onClose}
  title={editingId ? t('common.edit') : t('rooms.newRate')}
  size="lg"> <form className="space-y-5" onSubmit={e => { e.preventDefault(); onSave() }}> <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-[15px]"> <div className="floating-field is-filled"> <DropdownSelect
  ariaLabel={t('rooms.type')}
  options={[
   { label: t('rooms.selectOption'), value: '' },
  ...roomTypes.items.map(rt => ({ label: rt.name, value: rt.id })),
  ]}
  value={form.room_type_id}
  onChange={value => onFormChange({ room_type_id: value })}
  /> <span className="floating-label">{t('rooms.type')}</span> </div> <FloatingInput
  label={t('rooms.price')}
  type="number" inputMode="decimal"
  min={0}
  step="0.01"
  value={form.price}
  onChange={e => onFormChange({ price: Number(e.target.value) })}
  required
  /> <div className="floating-field is-filled"> <DropdownSelect
   ariaLabel={t('rooms.pricingForm.currency')}
  options={currencyOptions}
  value={form.currency}
  onChange={currency => onFormChange({ currency })}
    /> <span className="floating-label">{t('rooms.pricingForm.currency')}</span> </div> <FloatingInput
   label={t('rooms.detail.from')}
   type="date" max={form.effective_until || undefined}
   value={form.effective_from}
   onChange={e => onFormChange({ effective_from: e.target.value })}
   /> <FloatingInput
   label={t('rooms.detail.to')}
  type="date" min={form.effective_from || undefined}
  value={form.effective_until}
  onChange={e => onFormChange({ effective_until: e.target.value })}
  /> </div> {error && (
  <p className="text-sm text-[#9F2F2D] bg-[#FDEBEC] rounded-lg px-3 py-2">{error}</p> )}
  <div className="flex justify-end gap-2 pt-1"> <button type="button" onClick={onClose} className="rounded-lg border border-[#D4D4D4] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#F9F9F8] transition-colors"> {t('common.cancel')}
  </button> <button type="submit" disabled={saving} className="rounded-lg bg-[#1A1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"> {saving ? t('common.saving') : (editingId ? t('common.save') : t('common.create'))}
  </button> </div> </form> </Modal> )
}
