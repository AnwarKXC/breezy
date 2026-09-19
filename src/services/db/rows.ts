import { Prisma } from "@/generated/prisma/client";
import { DB_META, type DbModelName } from "@/generated/db-meta";
import type { Database, Tables } from "@/services/db/rowTypes";

/**
 * Converts a Prisma result into the JSON row shape the app was built on
 * (the PostgREST shape described by `Tables<...>`):
 *   Decimal -> number, @db.Date -> "YYYY-MM-DD", @db.Time -> "HH:MM:SS",
 *   other DateTime -> ISO string. Nested relations are converted recursively.
 */
export function serializeRow<M extends DbModelName>(model: M, row: unknown): Record<string, unknown> {
  const meta = DB_META[model] as { dateFields: readonly string[]; timeFields: readonly string[]; relations: Record<string, string> };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    const relation = meta.relations[key] as DbModelName | undefined;
    if (relation && value !== null && typeof value === "object" && !(value instanceof Date) && !Prisma.Decimal.isDecimal(value)) {
      out[key] = Array.isArray(value) ? value.map((v) => serializeRow(relation, v)) : serializeRow(relation, value);
    } else if (value instanceof Date) {
      out[key] = meta.dateFields.includes(key)
        ? value.toISOString().slice(0, 10)
        : meta.timeFields.includes(key)
          ? value.toISOString().slice(11, 19)
          : value.toISOString();
    } else if (Prisma.Decimal.isDecimal(value)) {
      out[key] = (value as Prisma.Decimal).toNumber();
    } else if (typeof value === "bigint") {
      out[key] = Number(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

type TableName = keyof Database["public"]["Tables"] & DbModelName;

/** Typed variant for plain rows of one table. */
export function toRow<M extends TableName>(model: M, row: unknown): Tables<M> {
  return serializeRow(model, row) as Tables<M>;
}

export function toRows<M extends TableName>(model: M, rows: unknown[]): Tables<M>[] {
  return rows.map((row) => toRow(model, row));
}

/**
 * Reverse of serializeRow for writes: converts a row-shaped input (string dates,
 * as used by `TablesInsert<...>` / `TablesUpdate<...>`) into Prisma data by
 * turning date / time / timestamp strings into Date objects. `undefined` keys
 * are dropped so partial updates stay partial.
 */
export function fromRow<M extends DbModelName>(model: M, input: Record<string, unknown>): Record<string, unknown> {
  const meta = DB_META[model] as { dateFields: readonly string[]; timeFields: readonly string[]; timestampFields: readonly string[] };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (typeof value === "string" && meta.dateFields.includes(key)) out[key] = dbDate(value);
    else if (typeof value === "string" && meta.timeFields.includes(key)) out[key] = dbTime(value);
    else if (typeof value === "string" && meta.timestampFields.includes(key)) out[key] = new Date(value);
    else out[key] = value;
  }
  return out;
}

/** "YYYY-MM-DD" (or ISO) -> Date at UTC midnight, for @db.Date columns. */
export function dbDate(value: string): Date;
export function dbDate(value: string | null | undefined): Date | null;
export function dbDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/** "HH:MM[:SS]" -> Date on 1970-01-01 UTC, for @db.Time columns. */
export function dbTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [h = "00", m = "00", s = "00"] = value.split(":");
  return new Date(`1970-01-01T${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.slice(0, 2).padStart(2, "0")}.000Z`);
}

/** ISO / Date -> Date, for timestamptz columns. */
export function dbTimestamp(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
