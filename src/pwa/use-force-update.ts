// 📁 src/pwa/use-force-update.ts - Force Update Hook

'use client'

import { useEffect, useState } from 'react'

/**
 * Refresh the page to get fresh content
 */
export function useForceUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    navigator.serviceWorker.addEventListener('updatefound', () => {
      const newSw = navigator.serviceWorker.controller
      if (newSw) {
        setUpdateAvailable(true)
      }
    })
  }, [])

  const handleUpdate = () => {
    navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' })
    window.location.reload()
  }

  return { updateAvailable, handleUpdate }
}