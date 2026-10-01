'use client'

import { useRef, useState } from 'react'

import { detectLang, type AssistantLang } from '../i18n'
import { AI_HISTORY_LIMIT, type AiErrorCode, type ChatHistoryItem, type ChatStreamLine, type ConversationDetail, type ResultBlock } from '../types'

export type ClientErrorCode = AiErrorCode | 'ai/forbidden' | 'ai/session' | 'ai/network'

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  blocks: ResultBlock[]
  /** Tools the assistant called, in order (shown as a progress hint). */
  tools: string[]
  status: 'streaming' | 'done' | 'error' | 'stopped'
  error?: ClientErrorCode
  /** Language of the question: the answer's cards and labels render in it. */
  lang: AssistantLang
}

/** UUID v4; crypto.randomUUID is missing on plain-http LAN origins, getRandomValues is not. */
function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function errorFromResponse(status: number, body: { error?: string } | null): ClientErrorCode {
  if (status === 401) return 'ai/session'
  if (status === 403) return 'ai/forbidden'
  if (status === 503) return 'ai/unavailable'
  if (status === 429) return body?.error === 'ai/budget_exceeded' ? 'ai/budget_exceeded' : 'ai/rate_limited'
  return 'ai/failed'
}

function toHistory(entries: ChatEntry[]): ChatHistoryItem[] {
  return entries
    .filter((entry) => entry.text.trim() && (entry.role === 'user' || entry.status === 'done'))
    .slice(-AI_HISTORY_LIMIT * 2)
    .map((entry) => ({ role: entry.role, text: entry.text.slice(0, 4000) }))
}

export function useAssistantChat() {
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [conversationId, setConversationId] = useState(newId)
  const abortRef = useRef<AbortController | null>(null)
  const busy = entries.some((entry) => entry.status === 'streaming')

  const update = (id: string, patch: (entry: ChatEntry) => Partial<ChatEntry>) =>
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch(entry) } : entry)))

  async function send(message: string) {
    const text = message.trim()
    if (!text || busy) return
    const history = toHistory(entries)
    const assistantId = newId()
    const lang = detectLang(text)
    setEntries((current) => [
      ...current,
      { id: newId(), role: 'user', text, blocks: [], tools: [], status: 'done', lang },
      { id: assistantId, role: 'assistant', text: '', blocks: [], tools: [], status: 'streaming', lang },
    ])

    const controller = new AbortController()
    abortRef.current = controller
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: text, history, locale: lang }),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        update(assistantId, () => ({ status: 'error', error: errorFromResponse(response.status, body) }))
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finished = false
      const apply = (line: ChatStreamLine) => {
        if (line.type === 'text') update(assistantId, (e) => ({ text: e.text + line.delta }))
        else if (line.type === 'block') update(assistantId, (e) => ({ blocks: [...e.blocks, line.block] }))
        else if (line.type === 'tool') update(assistantId, (e) => ({ tools: [...e.tools, line.name] }))
        else if (line.type === 'done') {
          finished = true
          update(assistantId, () => ({ status: 'done' }))
        } else if (line.type === 'error') {
          finished = true
          update(assistantId, () => ({ status: 'error', error: line.code }))
        }
      }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let newline: number
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const raw = buffer.slice(0, newline).trim()
          buffer = buffer.slice(newline + 1)
          if (raw) apply(JSON.parse(raw) as ChatStreamLine)
        }
      }
      if (!finished) update(assistantId, () => ({ status: 'error', error: 'ai/network' }))
    } catch {
      update(assistantId, () => (controller.signal.aborted ? { status: 'stopped' } : { status: 'error', error: 'ai/network' }))
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  function reset() {
    stop()
    setEntries([])
    setConversationId(newId())
  }

  /** Restores a saved conversation (with its result cards as they were) and continues it. */
  function openConversation(detail: ConversationDetail) {
    stop()
    setConversationId(detail.id)
    setEntries(
      detail.turns.flatMap((turn): ChatEntry[] => [
        { id: `${turn.id}-q`, role: 'user', text: turn.question, blocks: [], tools: [], status: 'done', lang: detectLang(turn.question) },
        {
          id: `${turn.id}-a`,
          role: 'assistant',
          text: turn.answer,
          blocks: turn.blocks,
          tools: [],
          status: turn.status === 'ok' ? 'done' : turn.status === 'aborted' ? 'stopped' : 'error',
          error: turn.status === 'error' ? ((turn.errorCode ?? 'ai/failed') as ClientErrorCode) : undefined,
          lang: detectLang(turn.question),
        },
      ]),
    )
  }

  return { entries, busy, conversationId, send, stop, reset, openConversation }
}
