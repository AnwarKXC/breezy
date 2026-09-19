'use client'

import React from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default'

interface StatusBadgeProps {
  status: string
  variant?: BadgeVariant
  label?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-[#EDF3EC] text-[#346538]',
  warning: 'bg-[#FBF3DB] text-[#956400]',
  error: 'bg-[#FDEBEC] text-[#9F2F2D]',
  info: 'bg-[#E1F3FE] text-[#1F6C9F]',
  default: 'bg-[#F9F9F8] text-[#787774]',
}

const defaultLabels: Record<string, string> = {
  available: 'Available',
  occupied: 'Occupied',
  maintenance: 'Maintenance',
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  'checked-in': 'Checked In',
  'checked-out': 'Checked Out',
  active: 'Active',
  inactive: 'Inactive',
}

export function StatusBadge({ status, variant = 'default', label }: StatusBadgeProps) {
  const { t } = useTranslation()
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.05em] ${variantStyles[variant]}`}
    >
      {label || defaultLabels[status] || t(`rooms.${status}`) || status}
    </span>
  )
}
