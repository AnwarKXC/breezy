import { Prisma } from "@/generated/prisma/client";

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/** reservation_rooms_no_overlap exclusion constraint (SQLSTATE 23P01): room double-booked. */
export function isOverlapViolation(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${JSON.stringify((error as { meta?: unknown }).meta ?? {})}` : String(error);
  return /23P01|exclusion constraint|no_overlap/i.test(text);
}
