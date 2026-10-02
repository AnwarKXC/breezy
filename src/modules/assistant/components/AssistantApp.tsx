'use client'

import { useEffect, useState } from 'react'

import { AssistantIcon } from '@/components/layout/LayoutIcons'
import { ACTIONS, canPerformAction } from '@/config/rbac'
import { useAuth } from '@/modules/auth'
import { useInstallPrompt } from '@/pwa'
import { useBranding } from '@/shared/branding/BrandingContext'

import { useAssistantChat } from '../hooks/useAssistantChat'
import { useAssistantT } from '../i18n'
import { label } from '../utils/format'
import { AssistantChat } from './AssistantChat'
import { AssistantHistory } from './AssistantHistory'
import { HistoryIcon } from './icons'

const iconButton = 'grid h-11 w-11 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-[#F1F1EF] hover:text-ink'

/** Registers the app's own worker, scoped to its pages (the dashboard keeps /sw.js at "/"). */
function useAssistantServiceWorker(locale: string) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/assistant-sw.js', { scope: `/${locale}/assistant` }).catch(() => undefined)
  }, [locale])
}

function InstallCard() {
  const { t } = useAssistantT()
  const { mode, install } = useInstallPrompt()
  const [showIosHelp, setShowIosHelp] = useState(false)
  if (mode === 'hidden') return null

  return (
    <section className="mt-6 rounded-xl border border-line bg-surface-muted p-4">
      <p className="text-sm font-medium text-ink">{label(t, 'assistant.app.installTitle')}</p>
      <p className="mt-1 text-xs text-ink-muted">{label(t, 'assistant.app.installHint')}</p>
      <button
        type="button"
        onClick={() => (mode === 'ios' ? setShowIosHelp((open) => !open) : void install())}
        aria-expanded={mode === 'ios' ? showIosHelp : undefined}
        className="mt-3 h-11 w-full rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
      >
        {label(t, 'assistant.app.install')}
      </button>
      {mode === 'ios' && showIosHelp && <p className="mt-3 text-xs text-ink">{label(t, 'assistant.app.iosInstructions')}</p>}
    </section>
  )
}

function Chat() {
  const { t, locale } = useAssistantT()
  const { displayName } = useBranding()
  const chat = useAssistantChat()
  const [view, setView] = useState<'chat' | 'history'>('chat')
  useAssistantServiceWorker(locale)

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <header className="flex items-center gap-2 border-b border-line ps-4 pe-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <AssistantIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-ink">{label(t, 'assistant.title')}</h1>
          <p className="truncate text-xs text-ink-muted">{displayName}</p>
        </div>
        {(chat.entries.length > 0 || view === 'history') && (
          <button
            type="button"
            onClick={() => {
              chat.reset()
              setView('chat')
            }}
            className="h-11 rounded-lg px-3 text-xs font-medium text-ink-muted hover:bg-[#F1F1EF] hover:text-ink"
          >
            {label(t, 'assistant.newChat')}
          </button>
        )}
        <button
          type="button"
          onClick={() => setView((current) => (current === 'history' ? 'chat' : 'history'))}
          className={`${iconButton} ${view === 'history' ? 'bg-[#F1F1EF] text-ink' : ''}`}
          aria-pressed={view === 'history'}
          aria-label={label(t, 'assistant.history.title')}
          title={label(t, 'assistant.history.title')}
        >
          <HistoryIcon />
        </button>
      </header>

      {view === 'chat' ? (
        <AssistantChat chat={chat} autoFocus={false} emptyExtra={<InstallCard />} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
          <AssistantHistory
            activeId={chat.conversationId}
            onOpen={(detail) => {
              chat.openConversation(detail)
              setView('chat')
            }}
          />
        </div>
      )}
    </div>
  )
}

/** Full-screen assistant for phones, installed as its own PWA from /{locale}/assistant. */
export function AssistantApp() {
  const { t, locale } = useAssistantT()
  const { role, initializing } = useAuth()

  if (initializing) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-white" role="status" aria-label={label(t, 'assistant.thinking')}>
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#D4D4D2] border-t-ink" />
      </div>
    )
  }

  if (!role || !canPerformAction(role, ACTIONS.AI_CHAT)) {
    return (
      <main className="fixed inset-0 grid place-items-center bg-white px-6 text-center">
        <div className="max-w-sm">
          <p className="text-sm text-ink">{label(t, 'assistant.errors.forbidden')}</p>
          <a href={`/${locale}/reservations`} className="mt-4 inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink">
            {label(t, 'assistant.app.openDashboard')}
          </a>
        </div>
      </main>
    )
  }

  return <Chat />
}
