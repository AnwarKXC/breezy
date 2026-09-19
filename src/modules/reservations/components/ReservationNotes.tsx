'use client'

import { useState } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { reservationService } from '@/services/reservationService'
import type { ReservationNote } from '@/modules/reservations/types'
import { toast } from '@/shared/toast/toastEvents'

interface Props {
  reservationId: string
  notes: ReservationNote[]
  onUpdate: () => void
}

export function ReservationNotes({ reservationId, notes, onUpdate }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!text.trim()) return
    setSaving(true)
    // The author is taken from the session on the server.
    const res = await reservationService.addNote({
      reservation_id: reservationId,
      message: text.trim(),
      created_by: '',
    })
    if (res.ok) {
      setText('')
      onUpdate()
    } else {
      toast.error(res.error?.message ?? 'Failed to add note')
    }
    setSaving(false)
  }

  return (
    <section className="rounded-xl border border-[#EAEAEA] bg-white p-6">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-[#787774]">{t('reservations.deskNotes')}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#1A1A1A]">{t('reservations.notesTitle')}</h2>
      </div>
      <div className="mb-4 space-y-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('reservations.addHandoverNotePlaceholder')}
          className="w-full rounded-lg border border-[#EAEAEA] bg-[#F9F9F8] px-4 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors placeholder:text-[#787774] focus:border-[#D4D4D4] focus:bg-white"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !text.trim()}
          className="w-full rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('reservations.addNoteButton')}
        </button>
      </div>
      {notes.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#EAEAEA] bg-[#F9F9F8] px-4 py-5 text-center text-sm text-[#787774]">
          {t('reservations.noNotesYet')}
        </div>
      )}
      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="border-b border-[#EAEAEA] pb-3 last:border-0 last:pb-0">
            <p className="text-sm leading-6 text-[#333333]">{note.message}</p>
            <p className="mt-1 text-xs font-medium text-[#787774]">
              {new Date(note.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
