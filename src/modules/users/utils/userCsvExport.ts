import type { User } from '../types'
import { formatUserDate } from './userUi'

interface ExportLabels {
  createdAt: string
  email: string
  name: string
  phone: string
  role: string
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

export function buildUsersCsv(
  users: User[],
  labels: ExportLabels,
  locale?: string,
) {
  const header = [labels.name, labels.email, labels.role, labels.phone, labels.createdAt]
  const rows = users.map((user) => [
    user.name,
    user.email,
    user.role,
    user.phone,
    formatUserDate(user, locale),
  ])

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n')
}
