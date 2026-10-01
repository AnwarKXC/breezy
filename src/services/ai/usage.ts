import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'

import type { ResultBlock } from '@/modules/assistant/types'

import type { ChatTurnResult } from './chat'
import { hotelDayStart } from './periods'

const MAX_STORED_BLOCKS_CHARS = 250_000
const STORED_ROWS_WHEN_LARGE = 50

/** Keeps history snapshots bounded: very large tables are stored with their first rows only. */
function blocksForStorage(blocks: ResultBlock[]): ResultBlock[] {
  if (JSON.stringify(blocks).length <= MAX_STORED_BLOCKS_CHARS) return blocks
  const trimmed = blocks.map((block) => (block.type === 'kpi' ? block : { ...block, rows: block.rows.slice(0, STORED_ROWS_WHEN_LARGE) }))
  return JSON.stringify(trimmed).length <= MAX_STORED_BLOCKS_CHARS ? trimmed : trimmed.filter((block) => block.type === 'kpi')
}

/** Tokens (input + output) the user spent since hotel-local midnight. */
export async function tokensUsedToday(userId: string, today: string): Promise<number> {
  const totals = await prisma.ai_chat_turns.aggregate({
    where: { user_id: userId, created_at: { gte: hotelDayStart(today) } },
    _sum: { input_tokens: true, output_tokens: true },
  })
  return (totals._sum.input_tokens ?? 0) + (totals._sum.output_tokens ?? 0)
}

export async function recordChatTurn(input: {
  userId: string
  conversationId: string
  question: string
  provider: string
  result: ChatTurnResult
  latencyMs: number
}) {
  try {
    await prisma.ai_chat_turns.create({
      data: {
        user_id: input.userId,
        conversation_id: input.conversationId,
        question: input.question,
        answer: input.result.answer,
        tool_calls: input.result.toolCalls as unknown as Prisma.InputJsonValue,
        blocks: blocksForStorage(input.result.blocks) as unknown as Prisma.InputJsonValue,
        provider: input.provider,
        model: input.result.model,
        input_tokens: input.result.usage.inputTokens,
        output_tokens: input.result.usage.outputTokens,
        status: input.result.status,
        error_code: input.result.errorCode ?? null,
        latency_ms: Math.max(0, Math.round(input.latencyMs)),
      },
    })
  } catch (error) {
    // Auditing must not break the answer the admin already received.
    console.error('[ai] failed to record chat turn:', error instanceof Error ? error.message : error)
  }
}
