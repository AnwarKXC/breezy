'use client'

import React, { useEffect, useId, type ReactNode } from 'react'
import { animationCSS, defaultDuration, type AOSAnimation } from './AOS'

export interface StaggerProps {
  /** Child elements */
  children: ReactNode
  /** Stagger delay between items */
  stagger?: number
  /** Animation */
  animation?: AOSAnimation
}

const staggerDefault = 50

/**
 * Stagger container - applies staggered animation to children
 * Use for: Table rows, Card lists, Menu items
 */
export function StaggerContainer({
  children,
  stagger = staggerDefault,
  animation = 'fade-up',
}: StaggerProps) {
  const childrenArray = React.Children.toArray(children)
  const containerId = useId()

  return (
    <div className="stagger-container" data-stagger-container={containerId}>
      {childrenArray.map((child, index) => (
        <div
          key={index}
          style={{
            opacity: 0,
            transform: animationCSS[animation],
            transition: `opacity ${defaultDuration}ms ease-out, transform ${defaultDuration}ms ease-out`,
            transitionDelay: `${index * stagger}ms`,
            willChange: 'opacity, transform',
          }}
          className="stagger-item"
          data-stagger-item={containerId}
        >
          {child}
        </div>
      ))}
      <StaggerObserver containerId={containerId} />
    </div>
  )
}

// Client-side observer for stagger items
function StaggerObserver({ containerId }: { containerId: string }) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            el.style.opacity = '1'
            el.style.transform = 'translateY(0) scale(1) translateX(0)'
          }
        })
      },
      { threshold: 0.1 }
    )

    document.querySelectorAll(`[data-stagger-item="${CSS.escape(containerId)}"]`).forEach((el) => {
      observer.observe(el)
    })

    return () => observer.disconnect()
  }, [containerId])

  return null
}
