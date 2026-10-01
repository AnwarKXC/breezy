// Arabic-aware text helpers for the AI assistant.

const ARABIC_INDIC_DIGITS = /[٠-٩]/g // ٠-٩
const PERSIAN_DIGITS = /[۰-۹]/g // ۰-۹
const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g
const TATWEEL = /ـ/g

/** ٠١٢٣ / ۰۱۲۳ → 0123, so numbers and dates reach the model and the DB in one form. */
export function normalizeDigits(value: string): string {
  return value
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0))
}

/**
 * Folds spelling variants so "محمد احمد" matches "مُحمّد أحمد":
 * strips tashkeel/tatweel, unifies alef/yaa/taa-marbuta/hamza forms, lower-cases Latin.
 */
export function normalizeForSearch(value: string): string {
  return normalizeDigits(value)
    .normalize('NFKC')
    .replace(TASHKEEL, '')
    .replace(TATWEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Digits only, for phone matching ("+20 100-123" → "20100123"). */
export function digitsOnly(value: string): string {
  return normalizeDigits(value).replace(/\D/g, '')
}

/** Every whitespace-separated query token must appear in the haystack. */
export function matchesAllTokens(haystack: string, query: string): boolean {
  const target = normalizeForSearch(haystack)
  const tokens = normalizeForSearch(query).split(' ').filter(Boolean)
  return tokens.length > 0 && tokens.every((token) => target.includes(token))
}
