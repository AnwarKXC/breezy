import 'server-only'

import { z } from 'zod'

import type { ResultBlock } from '@/modules/assistant/types'

import type { JsonSchema, ToolDefinition } from '../provider/types'

export interface ToolContext {
  /** Hotel-local today, YYYY-MM-DD. */
  today: string
  locale: 'ar' | 'en'
  systemCurrency: string
}

export interface ToolOutput {
  /** Compact JSON the model reads to write its explanation. */
  data: unknown
  /** Authoritative blocks the UI renders (tables, KPIs, bars). */
  blocks: ResultBlock[]
}

export interface AiTool {
  definition: ToolDefinition
  run(rawArgs: unknown, ctx: ToolContext): Promise<ToolOutput>
}

/** Thrown for problems the model can fix by calling again with other arguments. */
export class ToolInputError extends Error {}

const KEPT_KEYS = ['description', 'enum', 'minimum', 'maximum'] as const

/** Reduces zod's JSON Schema to the subset every provider accepts. */
function sanitize(node: Record<string, unknown>): JsonSchema {
  const variants = (node.anyOf ?? node.oneOf) as Record<string, unknown>[] | undefined
  if (variants?.length) {
    const first = variants.find((v) => v.type !== 'null') ?? variants[0]
    return sanitize({ ...first, description: node.description ?? first.description })
  }
  const rawType = Array.isArray(node.type) ? node.type.find((t) => t !== 'null') : node.type
  const out: JsonSchema = { type: (rawType ?? 'string') as JsonSchema['type'] }
  for (const key of KEPT_KEYS) {
    const value = node[key]
    if (value === undefined) continue
    if ((key === 'minimum' || key === 'maximum') && Math.abs(value as number) > 1e9) continue
    ;(out as unknown as Record<string, unknown>)[key] = value
  }
  if (node.items && typeof node.items === 'object') out.items = sanitize(node.items as Record<string, unknown>)
  if (node.properties && typeof node.properties === 'object') {
    out.properties = Object.fromEntries(
      Object.entries(node.properties as Record<string, Record<string, unknown>>).map(([key, value]) => [key, sanitize(value)]),
    )
    out.required = (node.required as string[] | undefined) ?? []
  }
  return out
}

export function defineTool<S extends z.ZodObject>(spec: {
  name: string
  description: string
  args: S
  run: (args: z.output<S>, ctx: ToolContext) => Promise<ToolOutput>
}): AiTool {
  const parameters = sanitize(z.toJSONSchema(spec.args, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>)
  return {
    definition: { name: spec.name, description: spec.description, parameters },
    async run(rawArgs, ctx) {
      const parsed = spec.args.safeParse(rawArgs ?? {})
      if (!parsed.success) {
        throw new ToolInputError(parsed.error.issues.map((issue) => `${issue.path.join('.') || 'args'}: ${issue.message}`).join('; '))
      }
      return spec.run(parsed.data, ctx)
    },
  }
}
