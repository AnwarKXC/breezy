'use client'

import React from 'react'
import { SkeletonCard } from './SkeletonCard'

// ============================================
// Skeleton Grid
// ============================================

export interface SkeletonGridProps {
  count?: number
  columns?: number
}

/** Skeleton for grid loading state */
export function SkeletonGrid({ count = 6, columns = 3 }: SkeletonGridProps) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}