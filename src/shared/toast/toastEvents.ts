import hotToast from 'react-hot-toast'

export type ToastVariant = 'default' | 'success' | 'info' | 'warning' | 'error'

export interface ToastInput {
  description?: string
  duration?: number
  title: string
  variant?: ToastVariant
}

function formatMessage(title: string, description?: string) {
  return description ? `${title}\n${description}` : title
}

const darkStyle = {
  background: '#1e293b',
  color: '#f1f5f9',
  borderRadius: '12px',
  padding: '12px 16px',
  fontSize: '14px',
  lineHeight: '1.5',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  border: '1px solid rgba(255,255,255,0.08)',
  maxWidth: '380px',
}

export const toast = {
  default(title: string, options: Omit<ToastInput, 'title' | 'variant'> = {}) {
    return hotToast(formatMessage(title, options.description), {
      duration: options.duration ?? 4200,
      style: darkStyle,
    })
  },
  error(title: string, options: Omit<ToastInput, 'title' | 'variant'> = {}) {
    return hotToast.error(formatMessage(title, options.description), {
      duration: options.duration ?? 4200,
      style: { ...darkStyle, background: '#2d1b1b', border: '1px solid rgba(255,77,87,0.25)' },
    })
  },
  info(title: string, options: Omit<ToastInput, 'title' | 'variant'> = {}) {
    return hotToast(formatMessage(title, options.description), {
      duration: options.duration ?? 4200,
      icon: 'ℹ️',
      style: { ...darkStyle, background: '#1a2a33', border: '1px solid rgba(56,189,248,0.25)' },
    })
  },
  show(input: ToastInput) {
    const method = input.variant && input.variant !== 'default' ? toast[input.variant] : toast.default
    return method(input.title, { description: input.description, duration: input.duration })
  },
  success(title: string, options: Omit<ToastInput, 'title' | 'variant'> = {}) {
    return hotToast.success(formatMessage(title, options.description), {
      duration: options.duration ?? 4200,
      style: { ...darkStyle, background: '#1a2b22', border: '1px solid rgba(0,230,117,0.25)' },
    })
  },
  warning(title: string, options: Omit<ToastInput, 'title' | 'variant'> = {}) {
    return hotToast(formatMessage(title, options.description), {
      duration: options.duration ?? 4200,
      icon: '⚠️',
      style: { ...darkStyle, background: '#2a281a', border: '1px solid rgba(255,209,26,0.25)' },
    })
  },
}
