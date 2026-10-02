import 'server-only'
import { prisma } from '@/services/db/prisma'

/** Coordinate draft edits/sends across every application process, without schema changes. */
export async function withDraftLocks<T>(mailboxEmail: string, uids: number[], run: () => Promise<T>): Promise<T> {
  if (!uids.length) return run()
  return prisma.$transaction(async (tx) => {
    for (const uid of [...new Set(uids)].sort((a, b) => a - b)) {
      const key = `email:draft:${mailboxEmail.toLowerCase()}:${uid}`
      const [result] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS locked`
      if (!result?.locked) throw new Error('email/draft_busy')
    }
    return run()
  }, { timeout: 120_000, maxWait: 5_000 })
}
