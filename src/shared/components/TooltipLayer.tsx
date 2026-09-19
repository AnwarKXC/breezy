'use client'

import { useEffect, useRef, useState } from 'react'

/*
 * One app-wide tooltip for the dashboard.
 *
 * Shows for:
 *  - any element with `data-tooltip="…"` (explicit hint text), and
 *  - icon-only buttons/links that carry an `aria-label` but no visible text,
 *    so every icon control explains itself without per-button wiring.
 *
 * Hover shows after a short delay, keyboard focus shows immediately, and
 * `data-tooltip-tap` elements (InfoHint) also open on tap for touch screens.
 */

const TOOLTIP_ID = 'app-tooltip'
const SHOW_DELAY_MS = 350
const GAP = 8
const EDGE = 8

const ICON_ONLY_SELECTOR = 'button[aria-label], a[aria-label], [role="button"][aria-label]'

interface TooltipState {
  text: string
  top: number
  left: number
  placement: 'top' | 'bottom'
}

function tooltipTextFor(element: Element | null): { target: HTMLElement; text: string } | null {
  if (!element) return null

  const explicit = element.closest<HTMLElement>('[data-tooltip]')
  if (explicit) {
    const text = explicit.dataset.tooltip?.trim()
    return text ? { target: explicit, text } : null
  }

  const iconOnly = element.closest<HTMLElement>(ICON_ONLY_SELECTOR)
  if (iconOnly && !iconOnly.hasAttribute('data-no-tooltip') && !iconOnly.textContent?.trim()) {
    const text = iconOnly.getAttribute('aria-label')?.trim()
    return text ? { target: iconOnly, text } : null
  }

  return null
}

function measure(target: HTMLElement, tip: HTMLElement): Omit<TooltipState, 'text'> {
  const rect = target.getBoundingClientRect()
  const tipRect = tip.getBoundingClientRect()
  const fitsAbove = rect.top - tipRect.height - GAP >= EDGE
  const placement = fitsAbove ? 'top' : 'bottom'
  const top = placement === 'top' ? rect.top - tipRect.height - GAP : rect.bottom + GAP
  const centered = rect.left + rect.width / 2 - tipRect.width / 2
  const left = Math.min(Math.max(centered, EDGE), window.innerWidth - tipRect.width - EDGE)
  return { top, left, placement }
}

export function TooltipLayer() {
  const [state, setState] = useState<TooltipState | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<HTMLElement | null>(null)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const clearDescribedBy = () => {
      const current = targetRef.current
      if (current?.getAttribute('aria-describedby') === TOOLTIP_ID) {
        current.removeAttribute('aria-describedby')
      }
    }

    const hide = () => {
      window.clearTimeout(timerRef.current)
      clearDescribedBy()
      targetRef.current = null
      setState(null)
    }

    const show = (target: HTMLElement, text: string) => {
      clearDescribedBy()
      targetRef.current = target
      // Explicit hints add information beyond the label, so expose them to screen readers.
      if (
        target.hasAttribute('data-tooltip') &&
        target.getAttribute('aria-label') !== text &&
        !target.hasAttribute('aria-describedby')
      ) {
        target.setAttribute('aria-describedby', TOOLTIP_ID)
      }
      // Render off-screen first; the layout effect below measures and places it.
      setState({ text, top: -9999, left: -9999, placement: 'top' })
    }

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const match = tooltipTextFor(event.target as Element)
      if (!match) return
      if (match.target === targetRef.current) return
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => show(match.target, match.text), SHOW_DELAY_MS)
    }

    const onPointerOut = (event: PointerEvent) => {
      const related = event.relatedTarget as Node | null
      const pending = tooltipTextFor(event.target as Element)
      if (pending && related && pending.target.contains(related)) return
      hide()
    }

    const onFocusIn = (event: FocusEvent) => {
      const element = event.target as HTMLElement
      if (!element.matches?.(':focus-visible')) return
      const match = tooltipTextFor(element)
      if (match) show(match.target, match.text)
    }

    const onClick = (event: MouseEvent) => {
      const tapTarget = (event.target as Element).closest<HTMLElement>('[data-tooltip-tap]')
      if (!tapTarget) {
        hide()
        return
      }
      const match = tooltipTextFor(tapTarget)
      if (!match) return
      if (targetRef.current === match.target) hide()
      else show(match.target, match.text)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }

    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', hide)
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)

    return () => {
      window.clearTimeout(timerRef.current)
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  // Place the tooltip once it has rendered and can be measured.
  useEffect(() => {
    if (!state || state.top !== -9999 || !tipRef.current || !targetRef.current) return
    const position = measure(targetRef.current, tipRef.current)
    setState((current) => (current ? { ...current, ...position } : current))
  }, [state])

  if (!state) return null

  return (
    <div
      id={TOOLTIP_ID}
      ref={tipRef}
      role="tooltip"
      className="pointer-events-none fixed z-[200] max-w-xs rounded-lg bg-[#1A1A1A] px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-lg animate-fade-in-fast"
      style={{ top: state.top, left: state.left }}
    >
      {state.text}
    </div>
  )
}
