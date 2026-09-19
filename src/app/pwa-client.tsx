// 📁 src/app/pwa-client.tsx - PWA Client Component for registration

'use client'

import { InstallPrompt, useRegisterSW } from '@/pwa'

/**
 * PWA Client Component
 * Handles service worker registration and update notifications
 * Must be used within a client component or use in layout with dynamic import
 */
export function PWAClient() {
  useRegisterSW({
    onSuccess: () => undefined,
    onUpdate: () => undefined,
    onError: () => undefined,
  })

  return <InstallPrompt />
}

export default PWAClient
