'use client'

import React from 'react'
import { Skeleton } from './Skeleton'

export interface SkeletonCardProps {
  variant?: 'default' | 'horizontal'
}

/** Skeleton for card loading states - grid views */
export function SkeletonCard({ variant = 'default' }: SkeletonCardProps) {
  const containerClass = 'rounded-xl border border-[#EAEAEA] bg-white p-6'

  if (variant === 'horizontal') {
    return (
      <div className={containerClass}>
        <div className="flex items-center gap-4">
          <Skeleton variant="circular" width="48px" height="48px" />
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height="16px" />
            <Skeleton width="40%" height="12px" />
          </div>
          <Skeleton variant="rounded" width="60px" height="28px" />
        </div>
      </div>
    )
  }

  return (
    <div className={containerClass}>
      <div className="space-y-3">
        <Skeleton variant="circular" width="40px" height="40px" />
        <Skeleton width="70%" height="20px" />
        <Skeleton width="50%" height="14px" />
        <div className="flex gap-2 pt-2">
          <Skeleton variant="rounded" width="60px" height="24px" />
          <Skeleton variant="rounded" width="60px" height="24px" />
        </div>
      </div>
    </div>
  )
}