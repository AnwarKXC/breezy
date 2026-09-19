import type { ContactType } from '../types'

interface ContactTypeBadgeProps {
  type: ContactType
  labels: Record<string, string>
}

const typeStyles: Record<ContactType, string> = {
  company: 'bg-purple-50 text-purple-700 border-purple-100',
  individual: 'bg-[#E1F3FE] text-[#1F6C9F] border-[#E1F3FE]',
}

export function ContactTypeBadge({ type, labels }: ContactTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${typeStyles[type]}`}
    >
      {labels[type]}
    </span>
  )
}
