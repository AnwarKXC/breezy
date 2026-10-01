// Organization identity (name, logo, contacts, socials) shared by server and client.
// Stored in `app_settings` under key='organization'; empty fields fall back to defaults.

export const DEFAULT_APP_NAME = 'Breezy System'
export const DEFAULT_LOGO_URL = '/Full Logo Green.png'

export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'x', 'tiktok', 'linkedin', 'youtube', 'whatsapp'] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export const MAX_PHONES = 5

export interface OrganizationDetails {
  name: string
  phones: string[]
  email: string
  website: string
  address: string
  socials: Partial<Record<SocialPlatform, string>>
  /** Printed under the contact lines on invoices, e.g. a tax registration number. */
  taxId: string
  /** Where the QR code on printed documents points; empty = the website. */
  qrLink: string
  showQr: boolean
  /** Closing line on invoices; empty = the built-in "Thank you for your stay". */
  invoiceFooter: string
}

/** What any visitor (including the login page) may see. */
export interface PublicBranding extends OrganizationDetails {
  /** `name` or the default app name. */
  displayName: string
  /** Custom logo URL or the built-in default. */
  logoUrl: string
  hasCustomLogo: boolean
}

export const EMPTY_ORGANIZATION: OrganizationDetails = {
  name: '',
  phones: [],
  email: '',
  website: '',
  address: '',
  socials: {},
  taxId: '',
  qrLink: '',
  showQr: true,
  invoiceFooter: '',
}

/**
 * The QR printed on documents and its caption: an explicit QR link, else the
 * website. Social profile links caption as "@handle", others as the host name.
 */
export function documentQr(org: Pick<OrganizationDetails, 'qrLink' | 'website' | 'showQr'>): { value: string; caption: string } | null {
  const value = (org.qrLink || org.website).trim()
  if (!org.showQr || !value) return null
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '')
    const handle = url.pathname.split('/').filter(Boolean)[0]?.replace(/^@/, '')
    const isSocial = /(^|\.)(instagram|facebook|tiktok|x|twitter|linkedin|youtube)\.com$/.test(host)
    return { value, caption: isSocial && handle ? `@${handle}` : host }
  } catch {
    return { value, caption: '' }
  }
}

export function brandingLogoUrl(fileId: string) {
  return `/api/branding/logo/${fileId}`
}
