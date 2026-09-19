'use client'

import { useEffect, useRef, RefObject } from 'react'

/**
 * Creates Intersection Observer hook for staggered animations
 */
export function useStaggerAnimation(ref: RefObject<HTMLElement>, options?: {
  threshold?: number
  rootMargin?: string
  once?: boolean
}) {
  const hasAnimated = useRef(false)
  const { threshold = 0.1, rootMargin = '0px', once = true } = options || {}

  useEffect(() => {
    if (!ref.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && (!once || !hasAnimated.current)) {
            hasAnimated.current = true
            const el = entry.target as HTMLElement
            el.style.opacity = '1'
            el.style.transform = 'translateY(0)'
          }
        })
      },
      { threshold, rootMargin }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [once, ref, rootMargin, threshold])
}
