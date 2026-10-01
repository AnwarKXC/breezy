import 'server-only'

import type { AiErrorCode, ChatHistoryItem, ChatStreamLine, ResultBlock } from '@/modules/assistant/types'

import { buildSystemPrompt } from './prompt'
import { ProviderError, type ChatMessage, type ChatProvider, type ChatUsage, type ToolCall, type ToolResult } from './provider/types'
import { AI_TOOLS, AI_TOOLS_BY_NAME, ToolInputError, type ToolContext } from './tools'

// Schema lookup + SQL + up to two SQL repairs + answer fit within this.
const MAX_STEPS = 7
const TOOL_TIMEOUT_MS = 15_000
const MAX_TOOL_RESULT_CHARS = 20_000
const UNAVAILABLE_MODEL_TTL_MS = 60 * 60_000

// Models the API reported as missing/retired (404). Skipped for an hour so every
// turn does not pay a failed round-trip before reaching the fallback model.
const unavailableModels = new Map<string, number>()

function isKnownUnavailable(model: string) {
  const until = unavailableModels.get(model)
  return until !== undefined && until > Date.now()
}

export interface ToolCallLog {
  name: string
  args: Record<string, unknown>
  ok: boolean
  error?: string
  ms: number
}

export interface ChatTurnResult {
  answer: string
  toolCalls: ToolCallLog[]
  /** Blocks shown to the admin, kept for conversation history. */
  blocks: ResultBlock[]
  usage: ChatUsage
  model: string
  status: 'ok' | 'error' | 'aborted'
  errorCode?: AiErrorCode
}

interface ChatTurnInput {
  provider: ChatProvider
  /** Used for the rest of the turn if the primary provider fails before answering. */
  fallbackProvider?: ChatProvider | null
  history: ChatHistoryItem[]
  question: string
  ctx: ToolContext
  signal: AbortSignal
  emit: (line: ChatStreamLine) => void
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tool timed out after ${ms} ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function modelContent(data: unknown): unknown {
  const json = JSON.stringify(data ?? null)
  return json.length <= MAX_TOOL_RESULT_CHARS ? data : `${json.slice(0, MAX_TOOL_RESULT_CHARS)}… (truncated; tell the user the table shows the full result)`
}

async function runTool(call: ToolCall, ctx: ToolContext, emit: ChatTurnInput['emit'], log: ToolCallLog[], shown: ResultBlock[]): Promise<ToolResult> {
  const started = Date.now()
  const tool = AI_TOOLS_BY_NAME.get(call.name)
  if (!tool) {
    log.push({ name: call.name, args: call.args, ok: false, error: 'unknown_tool', ms: 0 })
    return { callId: call.id, name: call.name, content: { error: `Unknown tool "${call.name}". Use only the provided tools.` } }
  }
  emit({ type: 'tool', name: call.name })
  try {
    const output = await withTimeout(tool.run(call.args, ctx), TOOL_TIMEOUT_MS)
    for (const block of output.blocks) {
      shown.push(block)
      emit({ type: 'block', block })
    }
    log.push({ name: call.name, args: call.args, ok: true, ms: Date.now() - started })
    return { callId: call.id, name: call.name, content: modelContent(output.data) }
  } catch (error) {
    const message = error instanceof ToolInputError ? error.message : 'The tool failed unexpectedly.'
    if (!(error instanceof ToolInputError)) console.error(`[ai] tool ${call.name} failed:`, error instanceof Error ? error.message : error)
    log.push({ name: call.name, args: call.args, ok: false, error: message, ms: Date.now() - started })
    return { callId: call.id, name: call.name, content: { error: message } }
  }
}

function providerErrorCode(error: unknown): AiErrorCode {
  if (error instanceof ProviderError && error.code === 'rate_limited') return 'ai/rate_limited'
  return 'ai/provider_error'
}

export async function runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const { ctx, emit, signal } = input
  const system = buildSystemPrompt(ctx)
  const tools = AI_TOOLS.map((tool) => tool.definition)
  const messages: ChatMessage[] = [
    ...input.history.map((item): ChatMessage => (item.role === 'user' ? { role: 'user', text: item.text } : { role: 'assistant', text: item.text })),
    { role: 'user', text: input.question },
  ]
  const usage: ChatUsage = { inputTokens: 0, outputTokens: 0 }
  const toolCalls: ToolCallLog[] = []
  const blocks: ResultBlock[] = []
  let provider = input.fallbackProvider && isKnownUnavailable(input.provider.model) ? input.fallbackProvider : input.provider
  let answer = ''

  const result = (status: ChatTurnResult['status'], errorCode?: AiErrorCode): ChatTurnResult => {
    if (errorCode) emit({ type: 'error', code: errorCode })
    else if (status === 'ok') emit({ type: 'done' })
    return { answer, toolCalls, blocks, usage, model: provider.model, status, errorCode }
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    let stepText = ''
    const calls: ToolCall[] = []
    let finish: { reason: string; providerData?: unknown } | null = null

    try {
      let stream
      try {
        stream = await provider.stream({ system, messages, tools, temperature: 0.1, maxOutputTokens: 1024, signal })
      } catch (error) {
        // Switch to the fallback model only when nothing has been shown yet.
        const canFallBack = input.fallbackProvider && provider !== input.fallbackProvider && !answer && !(error instanceof ProviderError && error.code === 'auth')
        if (error instanceof ProviderError && error.status === 404) unavailableModels.set(provider.model, Date.now() + UNAVAILABLE_MODEL_TTL_MS)
        if (!canFallBack || signal.aborted) throw error
        console.warn(`[ai] ${provider.model} failed, retrying with ${input.fallbackProvider!.model}:`, error instanceof Error ? error.message : error)
        provider = input.fallbackProvider!
        stream = await provider.stream({ system, messages, tools, temperature: 0.1, maxOutputTokens: 1024, signal })
      }

      for await (const event of stream) {
        if (event.type === 'text') {
          if (!stepText && answer) {
            answer += '\n\n'
            emit({ type: 'text', delta: '\n\n' })
          }
          stepText += event.delta
          answer += event.delta
          emit({ type: 'text', delta: event.delta })
        } else if (event.type === 'tool_call') {
          calls.push(event.call)
        } else {
          finish = event
          usage.inputTokens += event.usage.inputTokens
          usage.outputTokens += event.usage.outputTokens
        }
      }
    } catch (error) {
      if (signal.aborted) return result('aborted')
      console.error('[ai] provider error:', error instanceof Error ? error.message : error)
      return result('error', providerErrorCode(error))
    }

    messages.push({ role: 'assistant', text: stepText, toolCalls: calls, providerData: finish?.providerData })

    if (finish?.reason === 'safety' && !calls.length) return result('error', 'ai/blocked')
    if (!calls.length) return result('ok')

    const results: ToolResult[] = []
    for (const call of calls) {
      if (signal.aborted) return result('aborted')
      results.push(await runTool(call, ctx, emit, toolCalls, blocks))
    }
    messages.push({ role: 'tool', results })
  }

  return result('error', 'ai/too_many_steps')
}
