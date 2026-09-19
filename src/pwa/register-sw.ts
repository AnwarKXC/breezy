// 📁 src/pwa/register-sw.ts - Service Worker Registration

'use client'

import { useEffect, useState } from 'react'

interface RegisterSWOptions {
  onSuccess?: (registration: ServiceWorkerRegistration) => void
  onUpdate?: (registration: ServiceWorkerRegistration) => void
  onError?: (error: Error) => void
}

/**
 * Register Service Worker with update handling
 */
export function useRegisterSW(options: RegisterSWOptions = {}) {
  const [isReady, setIsReady] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const { onError, onSuccess, onUpdate } = options

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // A caching worker in development serves stale bundles and assets after edits.
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister()
      })
      return
    }

    async function register() {
      try {
        const swUrl = '/sw.js'
        const swRegistration = await navigator.serviceWorker.register(swUrl)

        swRegistration.onupdatefound = () => {
          const installing = swRegistration.installing
          if (!installing) return

          installing.onstatechange = () => {
            if (installing.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New content available
                setUpdateAvailable(true)
                onUpdate?.(swRegistration)
              } else {
                // Content cached
                setIsReady(true)
                onSuccess?.(swRegistration)
              }
            }
          }
        }

        setRegistration(swRegistration)
      } catch (error) {
        onError?.(error as Error)
      }
    }

    register()
  }, [onError, onSuccess, onUpdate])

  const update = async () => {
    if (!registration) return
    await registration.update()
  }

  return {
    isReady,
    updateAvailable,
    registration,
    update,
  }
}
