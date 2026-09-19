'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

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
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1A1A1A]/40 px-3 py-4 sm:px-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={`flex max-h-[calc(100vh-2rem)] w-full flex-col ${sizeClass[size]} overflow-hidden rounded-xl border border-[#EAEAEA] bg-white`}>
        {title && (
          <div className="flex shrink-0 items-center justify-between px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-6">
            <h3 className="text-lg font-bold text-[#1A1A1A]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#787774] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333]"
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
