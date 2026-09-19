import { useEffect, useRef } from 'react'

/** Calls `onEscape` when Escape is pressed while `enabled` — for hand-built dialogs and popovers. */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  const callbackRef = useRef(onEscape)

  useEffect(() => {
    callbackRef.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!enabled) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') callbackRef.current()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [enabled])
}
