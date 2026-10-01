'use client'

import Image from 'next/image'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { DEFAULT_APP_NAME, DEFAULT_LOGO_URL, EMPTY_ORGANIZATION, type PublicBranding } from './branding'

const FALLBACK: PublicBranding = {
  ...EMPTY_ORGANIZATION,
  displayName: DEFAULT_APP_NAME,
  logoUrl: DEFAULT_LOGO_URL,
  hasCustomLogo: false,
}

const BrandingContext = createContext<PublicBranding>(FALLBACK)
const SetBrandingContext = createContext<(next: PublicBranding) => void>(() => {})

/**
 * Seeded by the root layout from the DB. Settings applies its save response
 * immediately via `useSetBranding()`; the override is dropped once the server
 * sends a new value (after `router.refresh()` or navigation).
 */
export function BrandingProvider({ value, children }: { value: PublicBranding; children: ReactNode }) {
  const [override, setOverride] = useState<{ base: PublicBranding; value: PublicBranding } | null>(null)
  const current = override && override.base === value ? override.value : value
  const set = (next: PublicBranding) => setOverride({ base: value, value: next })
  return (
    <SetBrandingContext.Provider value={set}>
      <BrandingContext.Provider value={current}>{children}</BrandingContext.Provider>
    </SetBrandingContext.Provider>
  )
}

export function useBranding() {
  return useContext(BrandingContext)
}

export function useSetBranding() {
  return useContext(SetBrandingContext)
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
