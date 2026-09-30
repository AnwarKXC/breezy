import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma, withActor, type DbTransaction } from "@/services/db/prisma";
import { createReservationHold as createReservationHoldSql, createReservationWithRooms as createReservationWithRoomsSql, getRoomAvailability as getRoomAvailabilitySql } from "@/generated/prisma/sql";

/** Decimal -> number, bigint -> number, Date -> ISO string for raw query rows. */
function plain<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (Prisma.Decimal.isDecimal(value)) out[key] = (value as Prisma.Decimal).toNumber();
    else if (typeof value === "bigint") out[key] = Number(value);
    else if (value instanceof Date) out[key] = value.toISOString();
    else out[key] = value;
  }
  return out as T;
}

export interface RoomAvailabilityRow {
  room_id: string;
  room_number: string;
  floor: number;
  room_type_id: string;
  room_type_name: string;
  capacity: number;
  amenities: unknown;
  status: string;
  reason: string | null;
  base_price: number | null;
  effective_price: number | null;
  price_source: string | null;
  currency: string | null;
  price_single: number | null;
  price_double: number | null;
  price_triple: number | null;
}

export interface RoomAvailabilityArgs {
  checkIn: string;
  checkOut: string;
  roomTypeId?: string | null;
  capacity?: number | null;
  contactId?: string | null;
  excludeReservationId?: string | null;
  /** Prices resolve only from rate rows in this currency. */
  currency: string;
}

export async function getRoomAvailability(args: RoomAvailabilityArgs, tx: DbTransaction | typeof prisma = prisma) {
  const rows = await tx.$queryRawTyped(
    getRoomAvailabilitySql(
      args.checkIn,
      args.checkOut,
      args.roomTypeId ?? null,
      args.capacity ?? null,
      args.contactId ?? null,
      args.excludeReservationId ?? null,
      args.currency,
    ),
  );
  return rows.map((row) => plain<RoomAvailabilityRow>(row));
}

export async function createReservationHold(
  actorId: string,
  args: { roomId: string; checkIn: string; checkOut: string; reservationId?: string | null; holdDurationMinutes?: number },
) {
  return withActor(actorId, async (tx) => {
    const [row] = await tx.$queryRawTyped(
      createReservationHoldSql(args.roomId, args.checkIn, args.checkOut, args.reservationId ?? null, args.holdDurationMinutes ?? 15),
    );
    return row?.result;
  });
}

export async function createReservationWithRooms(
  actorId: string,
  args: {
    checkIn: string;
    checkOut: string;
    roomTypeCounts: unknown;
    contactId?: string | null;
    guestName?: string;
    guestId?: string | null;
    currency: string;
  },
) {
  return withActor(actorId, async (tx) => {
    const [row] = await tx.$queryRawTyped(
      createReservationWithRoomsSql(
        args.checkIn,
        args.checkOut,
        JSON.stringify(args.roomTypeCounts ?? []),
        args.contactId ?? null,
        args.guestName ?? "",
        args.guestId ?? null,
        actorId,
        args.currency,
      ),
    );
    return row?.result;
  });
}
