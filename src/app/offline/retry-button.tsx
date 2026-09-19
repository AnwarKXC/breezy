'use client'

import { useCallback } from 'react'

/**
 * Retry button - Client Component
 * Per spec: bg-[#1A1A1A] text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-[#333333] transition
 */
export function RetryButton() {
  const handleRetry = useCallback(() => {
    window.location.reload()
  }, [])

  return (
    <button
      onClick={handleRetry}
      className="
        rounded-xl bg-[#1A1A1A] px-4 py-2 text-sm font-bold text-white
        hover:bg-[#333333] transition
      "
    >
      {/* Refresh icon */}
      <svg
        className="w-4 h-4 inline-block mr-2"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.582 0a8.502 8.502 0 011.582 5.253m-1.582-5.253V4.5A2.5 2.5 0 0017.5 2H4v5m15.582 0a8.5 8.5 0 01-2.918 5.253M4 12.5a2.5 2.5 0 00-2.5 2.5v5a2.5 2.5 0 002.5 2.5H9v-5a2.5 2.5 0 002.5-2.5"
        />
      </svg>
      Try Again
    </button>
  )
}
