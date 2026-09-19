import type { LogAction, LogModule } from '@/types/logs'

export type { LogAction, LogModule }

export interface LogTimestampJson {
  nanoseconds: number
  seconds: number
}

export interface LogEntry {
  id: string
  action: LogAction
  actor: {
    displayName?: string
    id: string
    name?: string
  }
  module: LogModule
  target?: {
    id?: string
    type?: string
  }
  description: string
  createdAt: LogTimestampJson
}

export type LogsCursor = string

export interface LogsFilters {
  action?: LogAction
  fromDate?: string
  module?: LogModule
  toDate?: string
  userId?: string
}

export interface LogsResponse {
  data: LogEntry[]
  hasMore: boolean
  nextCursor: string | null
  total?: number
}

export interface LogsAnalytics {
  mostActiveUser: string
  mostUsedModule: LogModule | null
  totalActionsToday: number
}
