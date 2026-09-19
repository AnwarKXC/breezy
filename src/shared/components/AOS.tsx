'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export type AOSAnimation =
  | 'fade-up'
  | 'fade-down'
  | 'fade-in'

export interface AOSProps {
  animation?: AOSAnimation
  delay?: number
  duration?: number
  offset?: number
  children: ReactNode
  once?: boolean
  className?: string
}

export const defaultDuration = 600
const defaultOffset = 0

export const animationCSS: Record<AOSAnimation, string> = {
  'fade-up': 'translateY(12px)',
  'fade-down': 'translateY(-12px)',
  'fade-in': 'scale(0.9)',
}

export function AOS({
  animation = 'fade-up',
  delay = 0,
  duration = defaultDuration,
  offset = defaultOffset,
  once = true,
  children,
  className = '',
}: AOSProps) {
  const ref = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && (!once || !hasAnimated.current)) {
            hasAnimated.current = true
            const el = entry.target as HTMLElement
            el.style.opacity = '1'
            el.style.transform = 'translateY(0) scale(1) translateX(0)'
          }
        })
      },
      { threshold: 0.1, rootMargin: `${offset}px 0px` }
    )

    if (ref.current) {
      const el = ref.current
      el.style.opacity = '0'
      el.style.transform = animationCSS[animation]
      el.style.transition = `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`
      el.style.transitionDelay = `${delay}ms`
      observer.observe(el)
    }

    return () => observer.disconnect()
  }, [animation, delay, duration, offset, once])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
