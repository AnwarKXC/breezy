'use client'

import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export function Card({ children, className = '', padding = 'lg', onClick }: CardProps) {
  const paddingClass = padding === 'none' ? '' : 'p-6'
  
  return ( 
    <div 
      className={`
        relative rounded-xl border border-line bg-white
        transition duration-200
        hover:border-accent/30 hover:bg-accent/5
        ${paddingClass} 
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
