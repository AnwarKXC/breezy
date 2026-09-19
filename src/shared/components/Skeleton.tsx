'use client'

import React from 'react'

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  animation?: 'pulse' | 'wave' | 'none'
  width?: string
  height?: string
  className?: string
}

const variantStyles = {
  text: 'rounded-xl',
  circular: 'rounded-full',
  rectangular: 'rounded-xl',
  rounded: 'rounded-xl',
}

const animationStyles = {
  pulse: 'animate-pulse',
  wave: 'animate-shimmer',
  none: '',
}

export function Skeleton({
  variant = 'text',
  animation = 'pulse',
  width,
  height,
  className = '',
}: SkeletonProps) {
  return (
    <div
      className={`bg-[#EAEAEA] ${variantStyles[variant]} ${animationStyles[animation]} ${className}`}
      style={{ width, height, backgroundColor: '#EAEAEA' }}
    />
  )
}
