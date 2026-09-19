'use client'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Modal, FloatingInput } from '@/shared'
import type { Room } from '../types'

interface RoomRenameModalProps {
 room: Room | null
 number: string
 onNumberChange: (value: string) => void
   onSave: () => Promise<void>; onClose: () => void
 saving?: boolean
}

export function RoomRenameModal({ room, number, onNumberChange, onSave, onClose, saving }: RoomRenameModalProps) {
  const { t } = useTranslation()
  return (
  <Modal
  isOpen={Boolean(room)}
  onClose={onClose}
  title={room ? `Edit Room ${room.number.startsWith('TEMP') ? '-' : room.number}` : ''}
  size="md"> <form className="space-y-5" onSubmit={e => { e.preventDefault(); onSave() }}> <FloatingInput
  label={t('rooms.roomNumber')}
  value={number}
  onChange={e => onNumberChange(e.target.value)}
  /> <div className="flex justify-end gap-2 pt-1"> <button type="button" onClick={onClose} className="rounded-lg border border-[#D4D4D4] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#F9F9F8] transition-colors"> Cancel
  </button> <button
  type="submit"
  disabled={!number.trim() || saving}
  className="rounded-lg bg-[#1A1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"> {saving ? 'Saving...' : 'Save'}
  </button> </div> </form> </Modal> )
}
