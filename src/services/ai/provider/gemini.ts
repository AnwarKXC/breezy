import 'server-only'

import {
  ProviderError,
  type ChatMessage,
  type ChatProvider,
  type ChatStream,
  type ChatStreamEvent,
  type ChatStreamParams,
  type FinishReason,
  type JsonSchema,
  type ToolCall,
} from './types'

// Gemini Developer API (generativelanguage.googleapis.com), called with plain
// fetch + SSE so no SDK is needed. Docs: ai.google.dev/api/generate-content
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiPart {
  text?: string
  thought?: boolean
  thoughtSignature?: string
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> }
  functionResponse?: { name: string; response: Record<string, unknown> }
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

interface GeminiChunk {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
  promptFeedback?: { blockReason?: string }
  error?: { code?: number; message?: string }
}

/** Gemini expects OpenAPI-style upper-case types. */
function toGeminiSchema(schema: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: schema.type.toUpperCase() }
  if (schema.description) out.description = schema.description
  if (schema.enum) out.enum = schema.enum
  if (schema.minimum !== undefined) out.minimum = schema.minimum
  if (schema.maximum !== undefined) out.maximum = schema.maximum
  if (schema.items) out.items = toGeminiSchema(schema.items)
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)]))
    if (schema.required?.length) out.required = schema.required
  }
  return out
}

function toContents(messages: ChatMessage[]): GeminiContent[] {
  return messages.map((message): GeminiContent => {
    if (message.role === 'user') return { role: 'user', parts: [{ text: message.text }] }
    if (message.role === 'tool') {
      return {
        role: 'user',
        parts: message.results.map((result) => ({
          functionResponse: { name: result.name, response: { result: result.content } },
        })),
      }
    }
    // Replay the model's own parts verbatim when available: Gemini 3 models
    // reject function-call history that lost its thought signatures.
    if (Array.isArray(message.providerData) && message.providerData.length) {
      return { role: 'model', parts: message.providerData as GeminiPart[] }
    }
    const parts: GeminiPart[] = []
    if (message.text) parts.push({ text: message.text })
    for (const call of message.toolCalls ?? []) parts.push({ functionCall: { name: call.name, args: call.args } })
    return { role: 'model', parts: parts.length ? parts : [{ text: '' }] }
  })
}

function mapFinishReason(raw: string | undefined, hadToolCalls: boolean): FinishReason {
  if (hadToolCalls) return 'tool_calls'
  switch (raw) {
    case 'STOP':
    case undefined:
      return 'stop'
    case 'MAX_TOKENS':
      return 'length'
    case 'SAFETY':
    case 'RECITATION':
    case 'BLOCKLIST':
    case 'PROHIBITED_CONTENT':
    case 'SPII':
      return 'safety'
    default:
      return 'other'
  }
}

function errorFromStatus(status: number, body: string): ProviderError {
  // Never echo the request (it carries the key header) — only status + a short body excerpt.
  const detail = body.slice(0, 300)
  if (status === 429) return new ProviderError(status, 'rate_limited', `Gemini rate limit: ${detail}`)
  if (status === 401 || status === 403) return new ProviderError(status, 'auth', `Gemini auth failed: ${detail}`)
  if (status === 400 || status === 404) return new ProviderError(status, 'bad_request', `Gemini rejected request: ${detail}`)
  return new ProviderError(status, 'upstream', `Gemini error ${status}: ${detail}`)
}

async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<GeminiChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload) yield JSON.parse(payload) as GeminiChunk
      }
    }
    const rest = buffer.trim()
    if (rest.startsWith('data:') && rest.slice(5).trim()) yield JSON.parse(rest.slice(5).trim()) as GeminiChunk
  } finally {
    reader.releaseLock()
  }
}

async function* toEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
  const modelParts: GeminiPart[] = []
  let finishRaw: string | undefined
  let usage = { inputTokens: 0, outputTokens: 0 }
  let toolCallCount = 0
  let blocked = false

  for await (const chunk of readSse(body)) {
    if (chunk.error) throw new ProviderError(chunk.error.code ?? 500, 'upstream', chunk.error.message ?? 'Gemini stream error')
    if (chunk.promptFeedback?.blockReason) blocked = true
    if (chunk.usageMetadata) {
      usage = {
        inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
        outputTokens: (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0),
      }
    }
    const candidate = chunk.candidates?.[0]
    if (!candidate) continue
    if (candidate.finishReason) finishRaw = candidate.finishReason
    for (const part of candidate.content?.parts ?? []) {
      modelParts.push(part)
      if (part.functionCall) {
        const call: ToolCall = {
          id: part.functionCall.id ?? `call_${toolCallCount}`,
          name: part.functionCall.name,
          args: part.functionCall.args ?? {},
        }
        toolCallCount++
        yield { type: 'tool_call', call }
      } else if (part.text && !part.thought) {
        yield { type: 'text', delta: part.text }
      }
    }
  }

  yield {
    type: 'finish',
    reason: blocked ? 'safety' : mapFinishReason(finishRaw, toolCallCount > 0),
    usage,
    providerData: modelParts,
  }
}

export function createGeminiProvider(options: { apiKey: string; model: string }): ChatProvider {
  const { apiKey, model } = options
  return {
    name: 'gemini',
    model,
    async stream(params: ChatStreamParams): Promise<ChatStream> {
      const body = {
        systemInstruction: { parts: [{ text: params.system }] },
        contents: toContents(params.messages),
        tools: params.tools.length
          ? [
              {
                functionDeclarations: params.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  // Gemini rejects OBJECT schemas without properties: omit them for argument-less tools.
                  parameters: Object.keys(tool.parameters.properties ?? {}).length ? toGeminiSchema(tool.parameters) : undefined,
                })),
              },
            ]
          : undefined,
        toolConfig: params.tools.length ? { functionCallingConfig: { mode: 'AUTO' } } : undefined,
        generationConfig: {
          temperature: params.temperature ?? 0.1,
          maxOutputTokens: params.maxOutputTokens ?? 1024,
        },
      }

      const response = await fetch(`${BASE_URL}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: params.signal,
        cache: 'no-store',
      })

      if (!response.ok || !response.body) {
        throw errorFromStatus(response.status, await response.text().catch(() => ''))
      }
      return toEvents(response.body)
    },
  }
}
