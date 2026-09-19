'use client'

import { DropdownSelect } from '@/shared/components/DropdownSelect'

interface ToolbarFilterOption<T extends string> {
  label: string
  value: T
}

interface ToolbarFilterSelectProps<T extends string> {
  ariaLabel: string
  options: ToolbarFilterOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function ToolbarFilterSelect<T extends string>({
  ariaLabel,
  className = 'sm:min-w-44',
  onChange,
  options,
  value,
}: ToolbarFilterSelectProps<T>) {
  return (
    <DropdownSelect<T>
      ariaLabel={ariaLabel}
      className={className}
      onChange={onChange}
      options={options}
      value={value}
    />
  )
}
