'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useTranslation } from '@/i18n/hooks/useTranslation'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
  title: string
  size?: 'md' | 'lg' | 'xl'
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

const sizeClass = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-3xl',
}

export function Modal({ children, isOpen, onClose, title, size = 'md' }: ModalProps) {
  const { t } = useTranslation()
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    // Move focus into the dialog: first form field if any, else the first control.
    const dialog = dialogRef.current
    const firstField = dialog?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
    ;(firstField ?? dialog?.querySelector<HTMLElement>(FOCUSABLE))?.focus()

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      // Keep Tab focus inside the dialog.
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
      previouslyFocused?.focus?.()
    }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1A1A1A]/40 px-3 py-4 sm:px-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`flex max-h-[calc(100dvh-2rem)] w-full flex-col ${sizeClass[size]} overflow-hidden rounded-xl border border-[#EAEAEA] bg-white shadow-xl animate-fade-in-fast`}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-line bg-accent/10 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-6">
            <h3 id={titleId} className="text-lg font-bold text-[#1A1A1A]">{title}</h3>
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#787774] transition-colors hover:bg-accent/10 hover:text-[#333333]"
            >
              <CloseIcon />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
