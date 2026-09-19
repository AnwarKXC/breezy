// 📁 src/modules/users/hooks/useUserDetailsLabels.ts - User Details Labels Hook

import type { Locale } from '@/i18n/config'
import type { UserRole } from '../types'

export function useUserDetailsLabels(locale: Locale): Record<UserRole, string> {
  const labels: Record<Locale, Record<UserRole, string>> = {
    ar: {
      admin: 'مدير',
      accountant: 'محاسب',
      front_desk: 'موظف استقبال',
    },
    en: {
      admin: 'Admin',
      accountant: 'Accountant',
      front_desk: 'Front Desk',
    },
  }

  return labels[locale]
}