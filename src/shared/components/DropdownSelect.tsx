'use client'

import { useId, useState } from 'react'

import { useClickOutside } from '@/shared/hooks/useClickOutside'

interface DropdownOption<T extends string> {
  label: string
  value: T
}

interface DropdownSelectProps<T extends string> {
  ariaLabel: string
  options: DropdownOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="m7 10 5 5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export function DropdownSelect<T extends string>({
  ariaLabel,
  className = '',
  onChange,
  options,
  value,
}: DropdownSelectProps<T>) {
  const dropdownId = useId()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const selected = options.find((option) => option.value === value) ?? options[0]

  function handleChange(nextValue: T) {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        aria-controls={dropdownId}
        aria-expanded={open}
        aria-label={ariaLabel}
        className="form-control flex w-full items-center justify-between gap-3 text-start hover:bg-accent/10"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>{selected.label}</span>
        <ChevronIcon />
      </button>

      {open ? (
        <div
          className="absolute start-0 top-12 z-50 w-full min-w-40 overflow-hidden rounded-xl border border-[#EAEAEA] bg-white p-1.5 text-sm shadow-[0_18px_40px_rgba(16,26,36,0.14)]"
          id={dropdownId}
        >
          {options.map((option) => {
            const active = option.value === value

            return (
              <button
                aria-current={active ? 'true' : undefined}
                className={`block w-full rounded-xl px-3 py-2 text-start transition-colors ${
                  active ? 'bg-accent/10 font-semibold text-accent-ink' : 'text-[#333333] hover:bg-accent/10'
                }`}
                key={option.value}
                onClick={() => handleChange(option.value)}
                type="button"
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

