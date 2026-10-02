import { z } from 'zod'
import { MAX_PHONES, SOCIAL_PLATFORMS } from './branding'
import { phoneSchema } from '@/shared/phone'

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === '' || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value), 'must be an http(s) URL')

export const OrganizationUpdateSchema = z.object({
  name: z.string().trim().max(80),
  phones: z.array(phoneSchema).max(MAX_PHONES),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email())]),
  website: optionalUrl,
  address: z.string().trim().max(300),
  socials: z.object(Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, optionalUrl.optional()]))).strict(),
  taxId: z.string().trim().max(60).default(''),
  qrLink: optionalUrl.default(''),
  showQr: z.boolean().default(true),
  invoiceFooter: z.string().trim().max(160).default(''),
})
