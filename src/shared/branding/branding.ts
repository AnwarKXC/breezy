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
}

export function brandingLogoUrl(fileId: string) {
  return `/api/branding/logo/${fileId}`
}
