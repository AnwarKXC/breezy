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

// Sensible per-type behavior; any prop passed explicitly wins.
function inputTypeDefaults(type: InputHTMLAttributes<HTMLInputElement>['type']): InputHTMLAttributes<HTMLInputElement> {
  switch (type) {
    case 'number':
      return {
        inputMode: 'decimal',
        // Stop the mouse wheel from silently changing amounts while scrolling the page.
        onWheel: (event) => event.currentTarget.blur(),
      }
    case 'email':
      return { inputMode: 'email', autoComplete: 'email', dir: 'ltr', spellCheck: false, autoCapitalize: 'none' }
    case 'tel':
      return { inputMode: 'tel', autoComplete: 'tel', dir: 'ltr' }
    case 'search':
      return { inputMode: 'search', autoComplete: 'off', enterKeyHint: 'search' }
    default:
      return {}
  }
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
        {...inputTypeDefaults(props.type)}
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
