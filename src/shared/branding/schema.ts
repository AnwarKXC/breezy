import { z } from 'zod'
import { MAX_PHONES, SOCIAL_PLATFORMS } from './branding'

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === '' || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value), 'must be an http(s) URL')

const PHONE = /^\+?[0-9][0-9 ()-]{4,24}$/

export const OrganizationUpdateSchema = z.object({
  name: z.string().trim().max(80),
  phones: z.array(z.string().trim().regex(PHONE, 'invalid phone number')).max(MAX_PHONES),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email())]),
  website: optionalUrl,
  address: z.string().trim().max(300),
  socials: z.object(Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, optionalUrl.optional()]))).strict(),
})
