'use client'

import { FloatingInput } from '@/shared/components/FloatingField'

interface ToolbarSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function ToolbarSearch({ value, onChange, placeholder = 'Search...' }: ToolbarSearchProps) {
  return (
    <FloatingInput
      value={value}
      onChange={(e) => onChange(e.target.value)}
      label={placeholder}
      wrapperClassName="w-full sm:max-w-xs"
    />
  )
}
