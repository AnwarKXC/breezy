// Seeds essential data for initial setup. Idempotent: rows are upserted by
// their fixed id. Existing rows are left untouched (update: {}) so values the
// admin changed in the app are never overwritten.
//   pnpm db:seed
import 'dotenv/config'

import { prisma } from '@/services/db/prisma'

import { ACCOUNTING_SETTINGS, EXPENSE_CATEGORIES, ROOM_TYPES } from './data'

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const row of ACCOUNTING_SETTINGS) {
      await tx.accounting_settings.upsert({ where: { id: row.id }, create: row, update: {} })
    }
    for (const row of EXPENSE_CATEGORIES) {
      await tx.expense_categories.upsert({ where: { id: row.id }, create: row, update: {} })
    }
    for (const row of ROOM_TYPES) {
      await tx.room_types.upsert({ where: { id: row.id }, create: row, update: {} })
    }
  })

  console.log(
    `Seeded: ${ACCOUNTING_SETTINGS.length} settings, ${EXPENSE_CATEGORIES.length} expense categories, ${ROOM_TYPES.length} room types`,
  )
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
