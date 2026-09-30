import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'
import { dbDate, todayDate } from '@/services/db/rows'
import { toMoney, type Money } from '@/shared/currency/money'

export interface DashboardApiResponse {
  totalUsers: number
  activeBookings: number
  availableRooms: number
  /** One total per currency; never summed across currencies. */
  totalRevenue: Money
  occupancyRate: number
  todayCheckIns: number
  todayCheckOuts: number
}

export async function getDashboardData(): Promise<DashboardApiResponse> {
  const today = dbDate(todayDate())
  const liveStay: Prisma.reservationsWhereInput = { deleted_at: null, status: { notIn: ['cancelled', 'expired', 'no_show'] } }

  const [totalUsers, activeBookings, availableRooms, totalRooms, todayCheckIns, todayCheckOuts, revenue] = await Promise.all([
    prisma.profiles.count({ where: { deleted_at: null } }),
    prisma.reservations.count({ where: { deleted_at: null, status: { in: ['confirmed', 'checked_in'] } } }),
    prisma.rooms.count({ where: { deleted_at: null, status: 'available' } }),
    prisma.rooms.count({ where: { deleted_at: null } }),
    prisma.reservations.count({ where: { ...liveStay, check_in_date: today } }),
    prisma.reservations.count({ where: { ...liveStay, check_out_date: today } }),
    // Summed in the database instead of loading every reservation row.
    prisma.reservations.groupBy({
      by: ['currency'],
      where: { deleted_at: null, status: { in: ['confirmed', 'checked_in', 'checked_out'] } },
      _sum: { total_amount: true },
    }),
  ])

  return {
    totalUsers,
    activeBookings,
    availableRooms,
    totalRevenue: toMoney(revenue.map((g) => ({ amount: Number(g._sum.total_amount ?? 0), currency: g.currency }))),
    occupancyRate: totalRooms > 0 ? Math.round(((totalRooms - availableRooms) / totalRooms) * 100) : 0,
    todayCheckIns,
    todayCheckOuts,
  }
}
