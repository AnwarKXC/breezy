'use client'

import { useEffect, useRef } from 'react'

const animationCSS: Record<string, string> = {
  'fade-up': 'translateY(20px)',
  'fade-down': 'translateY(-20px)',
  'fade-in': 'scale(0.9)',
}

function setupAnimations(container: HTMLElement) {
  const elements = container.querySelectorAll<HTMLElement>('[data-aos]')
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          el.style.opacity = '1'
          el.style.transform = 'translateY(0) scale(1)'
          el.style.willChange = 'auto'
          observer.unobserve(el)
        }
      })
    },
    { threshold: 0.1, rootMargin: '60px 0px' },
  )

  elements.forEach((el) => {
    const anim = el.getAttribute('data-aos') ?? 'fade-up'
    const delay = parseInt(el.getAttribute('data-aos-delay') ?? '0', 10)
    const duration = 400

    el.style.opacity = '0'
    el.style.transform = animationCSS[anim] ?? animationCSS['fade-up']
    el.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`
    el.style.transitionDelay = `${delay}ms`
    el.style.willChange = 'opacity, transform'
    observer.observe(el)
  })

  return observer
}

export function AOSInit() {
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const docEl = document.documentElement
    observerRef.current = setupAnimations(docEl)

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement && (node.matches('[data-aos]') || node.querySelector('[data-aos]'))) {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
              if (observerRef.current) {
                observerRef.current.disconnect()
                observerRef.current = setupAnimations(docEl)
              }
            }, 100)
            return
          }
        }
      }
    })

    mutationObserver.observe(docEl, { childList: true, subtree: true })

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      observerRef.current?.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  return null
}

export default AOSInit
