import { useEffect, useRef } from 'react'

export function useInitialFetch(fn: () => void) {
  const calledRef = useRef(false)
  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true
    fn()
  }, [fn])
}
