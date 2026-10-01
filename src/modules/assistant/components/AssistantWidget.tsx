'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { AssistantIcon } from '@/components/layout/LayoutIcons'
import { ACTIONS, canPerformAction } from '@/config/rbac'
import { useAssistantT } from '../i18n'
import { useAuth } from '@/modules/auth'

import { useAssistantChat } from '../hooks/useAssistantChat'
import { label } from '../utils/format'

// The chat body (tables, blocks) loads only when the panel is first opened.
const AssistantChat = dynamic(() => import('./AssistantChat').then((m) => m.AssistantChat), { ssr: false })
const AssistantHistory = dynamic(() => import('./AssistantHistory').then((m) => m.AssistantHistory), { ssr: false })

const iconButton = 'grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-[#F1F1EF] hover:text-ink'

function ExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {expanded ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  )
}

function Panel() {
  const { t } = useAssistantT()
  const chat = useAssistantChat()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState<'chat' | 'history'>('chat')

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (view === 'history') setView('chat')
      else if (expanded) setExpanded(false)
      else setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, expanded, view])

  const title = label(t, 'assistant.title')

  return (
    <>
      {/* Launcher: stays mounted so the conversation survives closing the panel and changing pages. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label(t, 'assistant.open')}
        aria-expanded={open}
        className={`fixed bottom-24 end-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105 hover:bg-accent-hover lg:bottom-6 lg:end-6 ${open ? 'pointer-events-none scale-0 opacity-0' : ''}`}
      >
        <AssistantIcon />
        {chat.busy && <span className="absolute end-1 top-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-emerald-500" aria-hidden />}
      </button>

      {open && expanded && <div className="fixed inset-0 z-[60] hidden bg-black/30 sm:block" onClick={() => setExpanded(false)} aria-hidden />}

      <section
        role="dialog"
        aria-modal={expanded}
        aria-label={title}
        hidden={!open}
        className={`fixed z-[61] flex flex-col overflow-hidden bg-white shadow-2xl ${
          expanded
            ? 'inset-0 sm:inset-4 sm:rounded-2xl lg:inset-8'
            : 'inset-0 sm:inset-auto sm:bottom-24 sm:end-4 sm:h-[min(680px,calc(100dvh-8rem))] sm:w-[440px] sm:rounded-2xl sm:border sm:border-line lg:bottom-6 lg:end-6'
        }`}
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
            <AssistantIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
            <p className="truncate text-xs text-ink-muted">{label(t, 'assistant.tagline')}</p>
          </div>
          {(chat.entries.length > 0 || view === 'history') && (
            <button
              type="button"
              onClick={() => {
                chat.reset()
                setView('chat')
              }}
              className="h-9 rounded-lg px-2.5 text-xs font-medium text-ink-muted hover:bg-[#F1F1EF] hover:text-ink"
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
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5M12 7v5l3 2" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className={`${iconButton} hidden sm:grid`}
            aria-label={label(t, expanded ? 'assistant.collapse' : 'assistant.expand')}
            title={label(t, expanded ? 'assistant.collapse' : 'assistant.expand')}
          >
            <ExpandIcon expanded={expanded} />
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setExpanded(false)
            }}
            className={iconButton}
            aria-label={label(t, 'assistant.close')}
            title={label(t, 'assistant.close')}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        {open && view === 'chat' && <AssistantChat chat={chat} />}
        {open && view === 'history' && (
          <AssistantHistory
            activeId={chat.conversationId}
            onOpen={(detail) => {
              chat.openConversation(detail)
              setView('chat')
            }}
          />
        )}
      </section>
    </>
  )
}

/** Floating AI support assistant, shown on every dashboard screen to users with `ai:chat` (admins). */
export function AssistantWidget() {
  const { role } = useAuth()
  if (!role || !canPerformAction(role, ACTIONS.AI_CHAT)) return null
  return <Panel />
}
