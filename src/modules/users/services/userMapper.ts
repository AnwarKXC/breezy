import 'server-only'

import type { profiles } from '@/generated/prisma/client'
import type { User } from '../types'

export function mapProfileRow(row: profiles): User {
  const milliseconds = row.created_at.getTime()

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone ?? '',
    createdAt: {
      nanoseconds: (milliseconds % 1000) * 1000000,
      seconds: Math.floor(milliseconds / 1000),
    },
  }
}
