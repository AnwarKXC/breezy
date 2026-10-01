import 'server-only'

import { createGeminiProvider } from './provider/gemini'
import type { ChatProvider } from './provider/types'

// gemini-2.5-flash-lite is closed to new API users (Google returns 404 "no longer available").
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const DEFAULT_DAILY_TOKEN_LIMIT = 300_000

export type AiUnavailableReason = 'missing_key' | 'free_tier_requires_seeded_data' | 'free_tier_in_production'

export interface AiConfig {
  apiKey: string
  model: string
  fallbackModel: string | null
  tier: 'free' | 'paid'
  dailyTokenLimit: number
}

export function getAiConfig(): AiConfig {
  const limit = Number(process.env.AI_DAILY_TOKEN_LIMIT)
  return {
    apiKey: process.env.CHATBOT_KEY ?? '',
    model: process.env.CHATBOT_MODEL || DEFAULT_MODEL,
    fallbackModel: process.env.CHATBOT_MODEL_CALLBACK || null,
    tier: process.env.AI_GEMINI_TIER === 'paid' ? 'paid' : 'free',
    dailyTokenLimit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DAILY_TOKEN_LIMIT,
  }
}

function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false
  const name = host.trim().toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
  return name === 'localhost' || name === '127.0.0.1' || name === '::1'
}

/**
 * Google may use free-tier prompts (which include tool results = hotel data) to
 * improve its products. The free tier is therefore never allowed in production;
 * in development it runs for local testing (localhost) or when the operator
 * states the database holds seeded/fake data (AI_SEEDED_DATA_ONLY=true, e.g. a
 * dev server reached over the LAN).
 */
export function getAiUnavailableReason(config = getAiConfig(), requestHost?: string | null): AiUnavailableReason | null {
  if (!config.apiKey) return 'missing_key'
  if (config.tier === 'free') {
    if (process.env.NODE_ENV === 'production') return 'free_tier_in_production'
    if (process.env.AI_SEEDED_DATA_ONLY !== 'true' && !isLocalHost(requestHost)) return 'free_tier_requires_seeded_data'
  }
  return null
}

export function createChatProvider(config: AiConfig, model = config.model): ChatProvider {
  return createGeminiProvider({ apiKey: config.apiKey, model })
}
