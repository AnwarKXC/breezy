// 📁 src/shared/hooks/useClickOutside.ts
import { useEffect, useRef } from 'react'

/**
 * Click outside hook - detects clicks outside element
 * @param callback - Function to call when outside clicked
 * @returns ref to attach to element
 */
export function useClickOutside<T extends HTMLElement>(callback: () => void) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback()
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [callback])

  return ref
}