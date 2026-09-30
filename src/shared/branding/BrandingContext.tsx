'use client'

import Image from 'next/image'
import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_APP_NAME, DEFAULT_LOGO_URL, EMPTY_ORGANIZATION, type PublicBranding } from './branding'

const FALLBACK: PublicBranding = {
  ...EMPTY_ORGANIZATION,
  displayName: DEFAULT_APP_NAME,
  logoUrl: DEFAULT_LOGO_URL,
  hasCustomLogo: false,
}

const BrandingContext = createContext<PublicBranding>(FALLBACK)

/** Seeded by the root layout from the DB; refreshed by `router.refresh()` after edits. */
export function BrandingProvider({ value, children }: { value: PublicBranding; children: ReactNode }) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding() {
  return useContext(BrandingContext)
}

export function BrandLogo({ size, className, priority }: { size: number; className?: string; priority?: boolean }) {
  const { logoUrl, displayName } = useBranding()
  return (
    <Image
      alt={displayName}
      className={className}
      src={logoUrl}
      width={size}
      height={size}
      priority={priority}
      unoptimized
    />
  )
}
