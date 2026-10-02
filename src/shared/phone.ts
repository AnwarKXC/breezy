import { z } from 'zod'

// Numbers typed without a country code are assumed to be Egyptian.
export const DEFAULT_DIAL_CODE = '20'

export const PHONE_FORMAT_MESSAGE = 'Enter a valid phone number with country code, e.g. +20 10 1234 5678'

const E164 = /^\+[1-9]\d{7,14}$/
// Egyptian national numbers: mobile is 10 digits (10/11/12/15…), landline 8–9 (Alexandria 3+7, Cairo 2+8).
const EGYPT = /^\+20(?:1[0125]\d{8}|[2-9]\d{7,8})$/

/**
 * Turns whatever was typed into E.164 (`+201012345678`):
 * - Arabic/Persian digits become ASCII; spaces, dashes, dots and brackets are dropped.
 * - `00…` becomes `+…`.
 * - A local number (`01012345678` or `1012345678`) gets `+20`, dropping the trunk `0`.
 * - `201012345678` (Egyptian code typed without `+`) just gets the `+`.
 * Returns '' for empty input; never throws — validity is checked by `isValidPhone`.
 */
export function normalizePhone(raw: string): string {
  const ascii = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .trim()
  if (!ascii) return ''

  const hasPlus = ascii.startsWith('+')
  let digits = ascii.replace(/\D/g, '')
  if (!digits) return hasPlus ? '+' : ''

  if (hasPlus) return `+${digits}`
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (digits.startsWith(DEFAULT_DIAL_CODE) && digits.length >= 11) return `+${digits}`
  if (digits.startsWith('0')) digits = digits.slice(1)
  return `+${DEFAULT_DIAL_CODE}${digits}`
}

export function isValidPhone(phone: string): boolean {
  if (!E164.test(phone)) return false
  return phone.startsWith(`+${DEFAULT_DIAL_CODE}`) ? EGYPT.test(phone) : true
}

const phoneString = z
  .string()
  .transform(normalizePhone)
  .refine(isValidPhone, PHONE_FORMAT_MESSAGE)

/** Required phone, stored as E.164. */
export const phoneSchema = phoneString

/** Optional phone: '' / null / undefined all mean "no phone" (null). */
export const optionalPhoneSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  phoneString.nullable().optional(),
)
