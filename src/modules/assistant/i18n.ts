'use client'

import { createContext, useContext } from 'react'

import { useTranslation } from '@/i18n/hooks/useTranslation'

import ar from './locales/ar.json'
import en from './locales/en.json'

// The assistant ships its own dictionaries (both languages) because one
// conversation can mix languages: the widget chrome follows the app locale,
// while every answer (cards, labels, dates) follows the language of its question.

export type AssistantLang = 'ar' | 'en'

const DICTIONARIES: Record<AssistantLang, Record<string, unknown>> = { ar, en }

/** Keys are written as `assistant.<path>`; a missing key returns itself (like the app's t()). */
export function assistantT(lang: AssistantLang) {
  return (key: string): string => {
    let node: unknown = DICTIONARIES[lang]
    for (const part of key.replace(/^assistant\./, '').split('.')) {
      if (!node || typeof node !== 'object' || !(part in node)) return key
      node = (node as Record<string, unknown>)[part]
    }
    return typeof node === 'string' ? node : key
  }
}

/** Translator for the widget chrome, in the app's current language. */
export function useAssistantT() {
  const { locale } = useTranslation()
  return { t: assistantT(locale), locale }
}

/** Language of the answer being rendered (provided per message). */
export const AnswerLangContext = createContext<AssistantLang | null>(null)

/** Translator for answer content (cards, labels, dates): the answer's language, else the app's. */
export function useAnswerT() {
  const { locale: appLocale } = useTranslation()
  const locale = useContext(AnswerLangContext) ?? appLocale
  return { t: assistantT(locale), locale }
}

// Arabic, Arabic Supplement and Arabic Extended-A blocks.
const ARABIC_LETTERS = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g
const LATIN_LETTERS = /[A-Za-z]/g

/**
 * Language of a question. Arabic letters weigh 1.5× because Egyptian admins mix
 * English business words into Arabic ("عايز revenue by room type من أول السنة"),
 * while an English question that only quotes an Arabic name stays English.
 */
export function detectLang(text: string): AssistantLang {
  const arabic = text.match(ARABIC_LETTERS)?.length ?? 0
  const latin = text.match(LATIN_LETTERS)?.length ?? 0
  return arabic > 0 && arabic * 1.5 >= latin ? 'ar' : 'en'
}

export function langDir(lang: AssistantLang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr'
}
