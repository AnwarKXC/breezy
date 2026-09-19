'use client'

import React from 'react'
import { Skeleton } from './Skeleton'

// ============================================
// Skeleton Table Row
// ============================================

export interface SkeletonTableRowProps {
  columns?: number
}

/** Skeleton for table row loading state */
export function SkeletonTableRow({ columns = 4 }: SkeletonTableRowProps) {
  return (
    <tr className="border-b border-[#EAEAEA] dark:border-zinc-700">
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width="36px" height="36px" />
          <div className="space-y-1">
            <Skeleton width="120px" height="14px" />
            <Skeleton width="80px" height="10px" />
          </div>
        </div>
      </td>
      {Array.from({ length: columns - 1 }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <Skeleton width={`${60 + (i * 10)}%`} height="14px" />
        </td>
      ))}
    </tr>
  )
}

// ============================================
// Skeleton Table
// ============================================

export interface SkeletonTableProps {
  rows?: number
  columns?: number
  showHeader?: boolean
}

/** Skeleton for table loading state */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
}: SkeletonTableProps) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-[#EAEAEA] dark:border-zinc-700 overflow-hidden">
      <table className="w-full">
        {showHeader && (
          <thead className="bg-[#F5F5F5] dark:bg-zinc-900">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th
                  key={i}
                  className="py-3 px-4 text-left text-xs font-medium text-[#787774] dark:text-[#787774] uppercase tracking-wider"
                >
                  <Skeleton width="60px" height="12px" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  )
}