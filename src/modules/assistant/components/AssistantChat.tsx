'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import type { ChatEntry, useAssistantChat } from '../hooks/useAssistantChat'
import { AnswerLangContext, assistantT, langDir, useAssistantT } from '../i18n'
import { ASSISTANT_SUGGESTIONS, type SuggestionLanguage } from '../suggestions'
import { AI_MESSAGE_MAX_LENGTH } from '../types'
import { label } from '../utils/format'
import { ResultBlockView } from './ResultBlockView'

const SUGGESTION_LANG_KEY = 'assistant.suggestionLang'

/** Remembered per browser; falls back to the app language. Storage may be unavailable (private mode). */
function initialSuggestionLang(appLocale: SuggestionLanguage): SuggestionLanguage {
  try {
    const stored = localStorage.getItem(SUGGESTION_LANG_KEY)
    if (stored === 'ar' || stored === 'en') return stored
  } catch {
    // ignore
  }
  return appLocale
}

function SuggestionLanguageSwitch({ value, onChange }: { value: SuggestionLanguage; onChange: (lang: SuggestionLanguage) => void }) {
  const { t } = useAssistantT()
  const options: Array<{ lang: SuggestionLanguage; text: string }> = [
    { lang: 'ar', text: 'عربي' },
    { lang: 'en', text: 'English' },
  ]
  return (
    <div role="radiogroup" aria-label={label(t, 'assistant.suggestionLanguage')} className="inline-flex rounded-lg border border-line bg-surface-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.lang}
          type="button"
          role="radio"
          aria-checked={value === option.lang}
          lang={option.lang}
          onClick={() => onChange(option.lang)}
          className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${value === option.lang ? 'bg-accent/10 text-accent-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
        >
          {option.text}
        </button>
      ))}
    </div>
  )
}

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#D4D4D2] border-t-ink" aria-hidden />
}

/** An answer renders entirely in the language of its question (cards, labels, dates, direction). */
function AssistantMessage({ entry }: { entry: ChatEntry }) {
  const t = assistantT(entry.lang)
  const currentTool = entry.tools.at(-1)
  return (
    <AnswerLangContext.Provider value={entry.lang}>
      <div className="flex min-w-0 flex-col gap-3" lang={entry.lang} dir={langDir(entry.lang)}>
        {entry.status === 'streaming' && !entry.text && (
          <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
            <Spinner />
            {currentTool ? label(t, `assistant.tools.${currentTool}`, label(t, 'assistant.working')) : label(t, 'assistant.thinking')}
          </p>
        )}
        {entry.blocks.map((block, index) => (
          <ResultBlockView key={index} block={block} />
        ))}
        {entry.text && (
          // Plain text only: model output is never rendered as HTML/markdown (no links or images).
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-ink">
            {entry.text}
          </p>
        )}
        {entry.status === 'error' && (
          <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {label(t, `assistant.errors.${(entry.error ?? 'ai/failed').replace('ai/', '')}`, label(t, 'assistant.errors.failed'))}
          </p>
        )}
        {entry.status === 'stopped' && <p className="text-xs text-ink-muted">{label(t, 'assistant.stopped')}</p>}
      </div>
    </AnswerLangContext.Provider>
  )
}

/** Conversation + composer; fills its container (docked panel or full-screen modal). */
export function AssistantChat({
  chat,
  autoFocus = true,
  emptyExtra,
}: {
  chat: ReturnType<typeof useAssistantChat>
  /** Off in the phone app, where focusing on open would pop the keyboard over the suggestions. */
  autoFocus?: boolean
  /** Rendered under the suggestions while the conversation is empty. */
  emptyExtra?: ReactNode
}) {
  const { t, locale } = useAssistantT()
  const [draft, setDraft] = useState('')
  const [suggestionLang, setSuggestionLang] = useState<SuggestionLanguage>(() => initialSuggestionLang(locale))
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastEntry = chat.entries.at(-1)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true })
  }, [autoFocus])

  useEffect(() => {
    if (chat.entries.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat.entries.length, lastEntry?.blocks.length, lastEntry?.status])

  const changeSuggestionLang = (lang: SuggestionLanguage) => {
    setSuggestionLang(lang)
    try {
      localStorage.setItem(SUGGESTION_LANG_KEY, lang)
    } catch {
      // ignore
    }
  }

  const submit = (text = draft) => {
    if (!text.trim() || chat.busy) return
    void chat.send(text)
    setDraft('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          {chat.entries.length === 0 ? (
            <div>
              <p className="text-sm text-ink-muted">{label(t, 'assistant.emptyHint')}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-medium text-ink-muted">{label(t, 'assistant.suggestedQuestions')}</h3>
                <SuggestionLanguageSwitch value={suggestionLang} onChange={changeSuggestionLang} />
              </div>
              <div className="mt-2 grid gap-2 @lg:grid-cols-2" lang={suggestionLang} dir={suggestionLang === 'ar' ? 'rtl' : 'ltr'}>
                {ASSISTANT_SUGGESTIONS[suggestionLang].map((suggestion) => {
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => submit(suggestion)}
                      className="min-h-11 rounded-lg border border-line bg-surface-muted px-3 py-2 text-start text-sm text-ink transition-colors hover:border-[#D4D4D2] hover:bg-white"
                    >
                      {suggestion}
                    </button>
                  )
                })}
              </div>
              <p className="mt-4 text-xs text-ink-muted">{label(t, 'assistant.readOnlyNote')}</p>
              {emptyExtra}
            </div>
          ) : (
            chat.entries.map((entry) =>
              entry.role === 'user' ? (
                <div key={entry.id} className="flex justify-end">
                  <p dir="auto" className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-accent px-4 py-2.5 text-sm text-accent-foreground">
                    {entry.text}
                  </p>
                </div>
              ) : (
                <AssistantMessage key={entry.id} entry={entry} />
              ),
            )
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="border-t border-line bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto flex w-full max-w-5xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                submit()
              }
            }}
            rows={1}
            dir="auto"
            maxLength={AI_MESSAGE_MAX_LENGTH}
            placeholder={label(t, 'assistant.placeholder')}
            aria-label={label(t, 'assistant.placeholder')}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base text-ink sm:text-sm outline-none placeholder:text-[#A3A3A0] field-sizing-content"
          />
          {chat.busy ? (
            <button type="button" onClick={chat.stop} className="h-11 shrink-0 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-accent/10">
              {label(t, 'assistant.stop')}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {label(t, 'assistant.send')}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
