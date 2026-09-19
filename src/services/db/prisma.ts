import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { setActor } from "@/generated/prisma/sql";

// DATABASE_URL is checked at build time (validateEnv); a missing value surfaces
// on the first query instead of on import, so tests can import services freely.
function createPrismaClient() {
  // The DB is a remote pooler (~65 ms RTT, ~280 ms TLS connect): keep sockets warm
  // instead of pg's 10 s idle default so requests rarely pay for a new connection.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 5 * 60_000,
    keepAlive: true,
  });
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type DbTransaction = Prisma.TransactionClient;

/**
 * Runs `fn` in a transaction where database functions can read the acting user
 * through `private.current_user_id()` (the replacement for Supabase `auth.uid()`).
 */
export function withActor<T>(userId: string, fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawTyped(setActor(userId));
    return fn(tx);
  });
}
