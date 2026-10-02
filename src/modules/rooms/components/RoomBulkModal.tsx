'use client'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Modal, FloatingInput } from '@/shared'
import type { RoomType } from '@/modules/room-types/types'

interface RoomBulkModalProps {
 isOpen: boolean
 onClose: () => void
 bulkTotal: number
 onBulkTotalChange: (total: number) => void
 roomTypes: {
 items: RoomType[]
 }
  bulkDistribution: Record<string, number>; onBulkDistChange: (typeId: string, count: number) => void
 bulkDistSum: number
  onCreate: () => Promise<void>; creating: boolean
}

export function RoomBulkModal({
 isOpen,
 onClose,
 bulkTotal,
 onBulkTotalChange,
 roomTypes,
 bulkDistribution,
 onBulkDistChange,
 bulkDistSum,
 onCreate,
 creating,
}: RoomBulkModalProps) {
  const { t } = useTranslation()
  return (
  <Modal
  isOpen={isOpen}
  onClose={onClose}
  title={t('rooms.addRooms')}
  size="lg"> <form className="space-y-5 mt-[15px]" onSubmit={e => { e.preventDefault(); onCreate() }}> <FloatingInput
  label={t('rooms.totalRooms')}
  type="number" inputMode="numeric" step={1}
  min={1}
  value={bulkTotal}
  onChange={e => onBulkTotalChange(Number(e.target.value))}
  /> {roomTypes.items.length> 0 && (
  <div className="space-y-3">   <label className="block text-sm font-medium text-[#333333]">{t('rooms.roomTypeDistribution')}</label> <div className="space-y-2"> {roomTypes.items.map(rt => (
  <div key={rt.id} className="flex items-center justify-between gap-4"> <span className="text-sm text-[#1A1A1A] flex-1">{rt.name}</span> <input
  type="number" inputMode="numeric" step={1} onWheel={(event) => event.currentTarget.blur()}
  min={0}
  value={bulkDistribution[rt.id] ?? 0}
  onChange={e => onBulkDistChange(rt.id, Number(e.target.value))}
  className="w-20 rounded-lg border border-[#D4D4D4] px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-300"
  /> </div> ))}
  </div> {bulkDistSum !== bulkTotal && (
   <p className="text-xs text-amber-600"> {t('rooms.distributionMismatch').replace('{sum}', String(bulkDistSum)).replace('{total}', String(bulkTotal))}
  </p> )}
  </div> )}
   <div className="flex justify-end gap-2 pt-1"> <button type="button" onClick={onClose} className="rounded-lg border border-[#D4D4D4] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-accent/10 transition-colors"> {t('common.cancel')}
   </button> <button
   type="submit"
   disabled={creating || bulkDistSum !== bulkTotal}
   className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"> {creating ? t('rooms.creating') : t('rooms.createRooms').replace('{count}', String(bulkTotal))}
  </button> </div> </form> </Modal> )
}
