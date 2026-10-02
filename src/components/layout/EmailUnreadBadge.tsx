'use client'

import { useEffect, useEffectEvent } from 'react'
import { fetchData, useResource } from '@/shared/data/useResource'
import { useTranslation } from '@/i18n/hooks/useTranslation'

const STATUS_URL = '/api/settings/email/messages/status'
const fetchStatus = () => fetchData<{ unread: number }>(STATUS_URL)

export function EmailUnreadBadge({ mobile = false }: { mobile?: boolean }) {
  const { t } = useTranslation()
  const status = useResource(STATUS_URL, fetchStatus, { staleMs: 60_000 })
  const refresh = useEffectEvent(() => {
    const desktopVisible = window.matchMedia('(min-width: 1024px)').matches
    if (document.visibilityState === 'visible' && desktopVisible !== mobile) void status.refresh()
  })
  useEffect(() => {
    const timer = window.setInterval(refresh, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  if (status.error || !status.data?.unread) return null
  return (
    <span aria-label={`${status.data.unread} ${t('email.unreadMessages')}`} className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-accent-foreground">
      {status.data.unread > 99 ? '99+' : status.data.unread}
    </span>
  )
}
