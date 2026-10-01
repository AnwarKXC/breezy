import 'server-only'

import { getExpensesSummary, listExpenses } from './expenses'
import { getGuestHistory, getTopCompanies, getTopGuests, searchGuests } from './guests'
import { getOutstandingInvoices } from './invoices'
import { getOccupancy, getRevenueByRoomType, getRoomPerformance, getRoomStatus } from './occupancy'
import type { AiTool } from './registry'
import {
  getArrivalsDepartures,
  getReservationDetails,
  getReservationsBySource,
  getReservationSummary,
  searchReservations,
} from './reservations'
import { getNetSummary, getPaymentsSummary, getRevenueSummary, getRevenueTrend } from './revenue'
import { getSqlSchema, runReadonlySqlTool } from './sql'

// Read-only tools. Curated tools answer the common questions reliably; the
// guarded SQL pair (get_sql_schema + run_readonly_sql) is the last resort. When
// the ai_chat_turns log shows the same SQL question repeatedly, promote it to a
// curated tool.
export const AI_TOOLS: readonly AiTool[] = [
  getRevenueSummary,
  getRevenueTrend,
  getPaymentsSummary,
  getNetSummary,
  getOccupancy,
  getRevenueByRoomType,
  getRoomPerformance,
  getRoomStatus,
  getArrivalsDepartures,
  searchReservations,
  getReservationSummary,
  getReservationsBySource,
  getReservationDetails,
  searchGuests,
  getGuestHistory,
  getTopGuests,
  getTopCompanies,
  getOutstandingInvoices,
  getExpensesSummary,
  listExpenses,
  getSqlSchema,
  runReadonlySqlTool,
]

export const AI_TOOLS_BY_NAME = new Map(AI_TOOLS.map((tool) => [tool.definition.name, tool]))

export { ToolInputError, type ToolContext } from './registry'
