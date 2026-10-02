// 📁 src/shared/components/Loader.tsx
'use client'

import React from 'react'

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}

export function Loader({ size = 'md', fullScreen = false }: LoaderProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
        <div className={`animate-spin rounded-full border-2 border-[#D4D4D4] border-t-accent ${sizeStyles[size]}`} />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center p-4">
      <div className={`animate-spin rounded-full border-2 border-[#D4D4D4] border-t-accent ${sizeStyles[size]}`} />
    </div>
  )
}
