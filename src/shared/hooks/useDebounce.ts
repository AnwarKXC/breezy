// 📁 src/shared/hooks/useDebounce.ts
import { useState, useEffect } from 'react'

/**
 * Debounce hook - delays value update until delay passes
 * @param value - Value to debounce
 * @param delay - Delay in ms (default: 300)
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}