// Provider-independent chat contract. The chat loop, tools and route only depend
// on these types; adding OpenRouter/another vendor means one new adapter.

export interface JsonSchema {
  type: 'object' | 'string' | 'integer' | 'number' | 'boolean' | 'array'
  description?: string
  enum?: string[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  minimum?: number
  maximum?: number
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: JsonSchema
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  callId: string
  name: string
  content: unknown
}

export type ChatMessage =
  | { role: 'user'; text: string }
  /** `providerData` round-trips vendor-specific parts (e.g. Gemini thought signatures). */
  | { role: 'assistant'; text: string; toolCalls?: ToolCall[]; providerData?: unknown }
  | { role: 'tool'; results: ToolResult[] }

export interface ChatUsage {
  inputTokens: number
  outputTokens: number
}

export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'safety' | 'other'

export type ChatStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'finish'; reason: FinishReason; usage: ChatUsage; providerData?: unknown }

export type ChatStream = AsyncIterable<ChatStreamEvent>

export interface ChatStreamParams {
  system: string
  messages: ChatMessage[]
  tools: ToolDefinition[]
  temperature?: number
  maxOutputTokens?: number
  signal?: AbortSignal
}

export interface ChatProvider {
  readonly name: string
  readonly model: string
  stream(params: ChatStreamParams): Promise<ChatStream>
}

export class ProviderError extends Error {
  constructor(
    readonly status: number,
    readonly code: 'rate_limited' | 'auth' | 'bad_request' | 'upstream',
    message: string,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
