'use client'

import React from 'react'

interface GridItem {
  id: string
  [key: string]: unknown
}

interface GridProps {
  items: GridItem[]
  renderItem: (item: GridItem) => React.ReactNode
  keyField?: string
  columns?: 1 | 2 | 3 | 4 | 5 | 6
  gap?: 2 | 3 | 4 | 6
  loading?: boolean
  emptyMessage?: string
}

export function Grid({
  items,
  renderItem,
  keyField = 'id',
  columns = 3,
  gap = 4,
  loading,
  emptyMessage = 'No items',
}: GridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-6',
  }

  const gapSize = {
    2: 'gap-2',
    3: 'gap-3',
    4: 'gap-4',
    6: 'gap-6',
  }

  if (loading) {
    return (
      <div className={`grid ${gridCols[columns]} ${gapSize[gap]}`}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-32 bg-[#EAEAEA] rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="text-center py-12 text-[#787774]">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={`grid ${gridCols[columns]} ${gapSize[gap]}`}>
      {items.map((item) => (
        <div key={String(item[keyField])}>
          {renderItem(item)}
        </div>
      ))}
    </div>
  )
}