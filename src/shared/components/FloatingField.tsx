import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  trailing?: ReactNode
  wrapperClassName?: string
}

interface FloatingSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  wrapperClassName?: string
}

export function FloatingInput({
  className = '',
  label,
  trailing,
  wrapperClassName = '',
  ...props
}: FloatingInputProps) {
  return (
    <label className={`floating-field ${wrapperClassName}`}>
      <input
        {...props}
        className={`form-control floating-control ${trailing ? 'pr-11' : ''} ${className}`}
        placeholder=""
      />
      <span className="floating-label">{label}</span>
      {trailing}
    </label>
  )
}

export function FloatingSelect({
  children,
  className = '',
  label,
  wrapperClassName = '',
  ...props
}: FloatingSelectProps) {
  return (
    <label className={`floating-field is-filled ${wrapperClassName}`}>
      <select {...props} className={`form-control ${className}`}>
        {children}
      </select>
      <span className="floating-label">{label}</span>
    </label>
  )
}
