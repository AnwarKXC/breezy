import 'server-only'

import type { ConversationDetail, ConversationSummary, ResultBlock, UsageSummary } from '@/modules/assistant/types'
import { prisma } from '@/services/db/prisma'

import { getAiConfig } from './config'
import { addDays, hotelDayStart, hotelToday } from './periods'
import { tokensUsedToday } from './usage'
import { AI_TIMEZONE } from './timezone'

const CONVERSATION_LIST_LIMIT = 30
const TURNS_PER_CONVERSATION_LIMIT = 50
const USAGE_DAYS = 30

/** The user's recent conversations, newest first. */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const groups = await prisma.ai_chat_turns.groupBy({
    by: ['conversation_id'],
    where: { user_id: userId },
    _count: { _all: true },
    _max: { created_at: true },
    orderBy: { _max: { created_at: 'desc' } },
    take: CONVERSATION_LIST_LIMIT,
  })
  if (!groups.length) return []
  const firstTurns = await prisma.ai_chat_turns.findMany({
    where: { user_id: userId, conversation_id: { in: groups.map((g) => g.conversation_id) } },
    orderBy: { created_at: 'asc' },
    distinct: ['conversation_id'],
    select: { conversation_id: true, question: true },
  })
  return groups.map((group) => ({
    id: group.conversation_id,
    title: firstTurns.find((turn) => turn.conversation_id === group.conversation_id)?.question.slice(0, 120) ?? '',
    turns: group._count._all,
    updatedAt: group._max.created_at?.toISOString() ?? '',
  }))
}

/** One conversation of the user, oldest turn first; null when it does not exist or is not theirs. */
export async function getConversation(userId: string, conversationId: string): Promise<ConversationDetail | null> {
  const turns = await prisma.ai_chat_turns.findMany({
    where: { user_id: userId, conversation_id: conversationId },
    orderBy: { created_at: 'asc' },
    take: TURNS_PER_CONVERSATION_LIMIT,
    select: { id: true, question: true, answer: true, blocks: true, status: true, error_code: true, created_at: true },
  })
  if (!turns.length) return null
  return {
    id: conversationId,
    turns: turns.map((turn) => ({
      id: turn.id,
      question: turn.question,
      answer: turn.answer,
      blocks: (Array.isArray(turn.blocks) ? turn.blocks : []) as unknown as ResultBlock[],
      status: turn.status,
      errorCode: turn.error_code,
      createdAt: turn.created_at.toISOString(),
    })),
  }
}

function hotelDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AI_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
}

/** Token use against the daily budget, a 30-day trend and the most used tools. */
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const today = hotelToday()
  const since = addDays(today, -(USAGE_DAYS - 1))
  const [usedToday, turns] = await Promise.all([
    tokensUsedToday(userId, today),
    prisma.ai_chat_turns.findMany({
      where: { user_id: userId, created_at: { gte: hotelDayStart(since) } },
      select: { created_at: true, input_tokens: true, output_tokens: true, status: true, tool_calls: true, latency_ms: true },
      take: 10_000,
    }),
  ])

  const days = new Map<string, { date: string; turns: number; tokens: number; errors: number }>()
  for (let i = 0; i < USAGE_DAYS; i++) {
    const date = addDays(since, i)
    days.set(date, { date, turns: 0, tokens: 0, errors: 0 })
  }
  const tools = new Map<string, number>()
  let latencyTotal = 0
  for (const turn of turns) {
    const day = days.get(hotelDate(turn.created_at))
    if (day) {
      day.turns++
      day.tokens += turn.input_tokens + turn.output_tokens
      if (turn.status === 'error') day.errors++
    }
    latencyTotal += turn.latency_ms
    for (const call of Array.isArray(turn.tool_calls) ? (turn.tool_calls as Array<{ name?: unknown }>) : []) {
      if (typeof call?.name === 'string') tools.set(call.name, (tools.get(call.name) ?? 0) + 1)
    }
  }

  return {
    today: { tokens: usedToday, limit: getAiConfig().dailyTokenLimit },
    period: { from: since, to: today },
    turns: turns.length,
    errors: turns.filter((t) => t.status === 'error').length,
    avgLatencyMs: turns.length ? Math.round(latencyTotal / turns.length) : 0,
    daily: [...days.values()],
    topTools: [...tools].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, calls]) => ({ name, calls })),
  }
}
