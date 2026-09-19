'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface UseDebounceOptions {
  leading?: boolean
  trailing?: boolean
}

export function useDebounce<T>(value: T, delay: number, options: UseDebounceOptions = {}): T {
  const { leading = false, trailing = true } = options
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const leadingRef = useRef(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (leading && leadingRef.current) {
      setDebouncedValue(value)
      leadingRef.current = false
      return
    }

    if (trailing) {
      clear()
      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(value)
        leadingRef.current = true
      }, delay)
    }

    return clear
  }, [value, delay, leading, trailing, clear])

  return debouncedValue
}
