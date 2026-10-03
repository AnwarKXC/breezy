'use client'

import { useState } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useResource, fetchData } from '@/shared/data/useResource'
import { useCan } from '@/shared/rbac/useCan'
import { ACTIONS } from '@/config/rbac'
import type { ReservationActivityEvent } from '@/modules/reservations/types'

const KIND_LABEL: Record<Exclude<ReservationActivityEvent['kind'], 'created' | 'status'>, string> = {
  stay_change: 'stayChanged',
  price_change: 'priceChanged',
  extra_charge: 'extraCharge',
  note: 'noteAdded',
  edited: 'edited',
  guest_added: 'guestAdded',
  guest_updated: 'guestUpdated',
  guest_removed: 'guestRemoved',
}

/** Admin-only, collapsed by default: who performed each important action on this reservation. */
export function ReservationActivity({ reservationId }: { reservationId: string }) {
  const canView = useCan(ACTIONS.RESERVATIONS_VIEW_AUDIT)
  if (!canView) return null
  return <ActivityPanel reservationId={reservationId} />
}

function ActivityPanel({ reservationId }: { reservationId: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const url = `/api/reservations/${reservationId}/activity`
  // Only fetched once the admin opens the panel.
  const activity = useResource(open ? url : null, () => fetchData<ReservationActivityEvent[]>(url))
  const events = activity.data ?? []

  const title = (e: ReservationActivityEvent) => {
    if (e.kind === 'created') return t('reservations.activity.created')
    if (e.kind === 'status') return t(`reservations.activity.status.${e.status}`)
    return t(`reservations.activity.${KIND_LABEL[e.kind]}`)
  }

  return (
    <section className="rounded-xl border border-[#EAEAEA] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-start"
      >
        <span>
          <span className="block text-xs font-medium uppercase tracking-wide text-[#787774]">{t('reservations.activity.adminOnly')}</span>
          <span className="mt-1 block text-base font-semibold text-[#1A1A1A]">{t('reservations.activity.title')}</span>
        </span>
        <svg className={`h-4 w-4 shrink-0 text-[#787774] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[#EAEAEA] px-6 py-4">
          {activity.isLoading ? (
            <p className="text-sm text-[#787774]">{t('common.loading')}</p>
          ) : activity.error ? (
            <p className="text-sm text-rose-700">{t('reservations.activity.loadFailed')}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-[#787774]">{t('reservations.activity.empty')}</p>
          ) : (
            <ol className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="border-b border-[#EAEAEA] pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-[#333333]">{title(e)}</p>
                  {e.detail && <p className="mt-0.5 break-words text-xs text-[#555555]">{e.detail}</p>}
                  <p className="mt-0.5 text-xs text-[#787774]">
                    {e.actor ? `${e.actor.name} · ${t(`users.roles.${e.actor.role === 'front_desk' ? 'frontDesk' : e.actor.role}`)}` : t('reservations.activity.unknownUser')}
                    {' · '}
                    {new Date(e.at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
