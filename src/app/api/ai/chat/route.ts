import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ACTIONS } from '@/config/rbac'
import { AI_HISTORY_LIMIT, AI_MESSAGE_MAX_LENGTH, type ChatStreamLine } from '@/modules/assistant/types'
import { normalizeDigits } from '@/services/ai/arabic'
import { runChatTurn } from '@/services/ai/chat'
import { createChatProvider, getAiConfig, getAiUnavailableReason } from '@/services/ai/config'
import { hotelToday } from '@/services/ai/periods'
import { recordChatTurn, tokensUsedToday } from '@/services/ai/usage'
import { getSystemCurrency } from '@/shared/currency/server'
import { RateLimitTier } from '@/shared/rateLimit'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TURN_TIMEOUT_MS = 90_000

const bodySchema = z.object({
  conversationId: z.guid(),
  message: z.string().trim().min(1).max(AI_MESSAGE_MAX_LENGTH),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(4000) }))
    .max(AI_HISTORY_LIMIT * 2)
    .default([]),
  locale: z.enum(['ar', 'en']).default('en'),
})

export async function POST(request: Request) {
  return secureMutationEndpoint(
    request,
    ACTIONS.AI_CHAT,
    async (session) => {
      const config = getAiConfig()
      const unavailable = getAiUnavailableReason(config, request.headers.get('host'))
      if (unavailable) return NextResponse.json({ error: 'ai/unavailable', reason: unavailable }, { status: 503 })

      const parsed = bodySchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) return NextResponse.json({ error: 'ai/invalid_request' }, { status: 400 })
      const { conversationId, locale } = parsed.data
      const question = normalizeDigits(parsed.data.message)
      const history = parsed.data.history.slice(-AI_HISTORY_LIMIT * 2).map((item) => ({ ...item, text: normalizeDigits(item.text) }))

      const today = hotelToday()
      if ((await tokensUsedToday(session.id, today)) >= config.dailyTokenLimit) {
        return NextResponse.json({ error: 'ai/budget_exceeded' }, { status: 429 })
      }
      const systemCurrency = await getSystemCurrency()

      const provider = createChatProvider(config)
      const fallbackProvider = config.fallbackModel ? createChatProvider(config, config.fallbackModel) : null
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(TURN_TIMEOUT_MS)])
      const encoder = new TextEncoder()
      const started = Date.now()

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const emit = (line: ChatStreamLine) => {
            try {
              controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`))
            } catch {
              // Client went away; the abort signal stops the turn.
            }
          }
          const result = await runChatTurn({
            provider,
            fallbackProvider,
            history,
            question,
            ctx: { today, locale, systemCurrency },
            signal,
            emit,
          })
          await recordChatTurn({ userId: session.id, conversationId, question, provider: provider.name, result, latencyMs: Date.now() - started })
          try {
            controller.close()
          } catch {
            // already closed by a cancelled request
          }
        },
      })

      return new NextResponse(stream, {
        headers: {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'cache-control': 'no-store, no-transform',
          'x-accel-buffering': 'no',
        },
      })
    },
    RateLimitTier.AI,
  )
}
