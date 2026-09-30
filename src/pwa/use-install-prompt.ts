'use client'

import { useEffect, useState } from 'react'

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// The browser may fire `beforeinstallprompt` before React hydrates, so capture it at module load.
let deferredEvent: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredEvent = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredEvent = null
    notify()
  })
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  const ua = navigator.userAgent
  // iPadOS reports itself as Mac; touch support distinguishes it.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

/**
 * - `prompt`: native install dialog available (Chromium/Edge/Android).
 * - `ios`: no native prompt; user must use Share → Add to Home Screen.
 * - `hidden`: already installed, running standalone, or not installable.
 */
export type InstallMode = 'prompt' | 'ios' | 'hidden'

export function useInstallPrompt() {
  const [mode, setMode] = useState<InstallMode>('hidden')

  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)')
    const sync = () => {
      if (installed || isStandalone()) setMode('hidden')
      else if (deferredEvent) setMode('prompt')
      else if (isIos()) setMode('ios')
      else setMode('hidden')
    }
    sync()
    listeners.add(sync)
    standaloneQuery.addEventListener('change', sync)
    return () => {
      listeners.delete(sync)
      standaloneQuery.removeEventListener('change', sync)
    }
  }, [])

  const install = async (): Promise<boolean> => {
    const event = deferredEvent
    if (!event) return false
    // The event can only be used once.
    deferredEvent = null
    await event.prompt()
    const { outcome } = await event.userChoice
    notify()
    return outcome === 'accepted'
  }

  return { mode, install }
}
