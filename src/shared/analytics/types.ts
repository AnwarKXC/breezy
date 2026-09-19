// 📁 src/shared/analytics/types.ts - Analytics types

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year'

export interface AnalyticsMetric {
  id: string
  label: string
  value: number
  previousValue?: number
  change?: number
  changeType?: 'increase' | 'decrease' | 'neutral'
}

export interface AnalyticsCard {
  id: string
  title: string
  value: number | string
  suffix?: string
  change?: number
  trend?: 'up' | 'down' | 'neutral'
  icon?: string
  color?: string
}

export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string
}

export interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

export interface AnalyticsFilter {
  period: AnalyticsPeriod
  startDate?: Date
  endDate?: Date
  groupBy?: 'day' | 'week' | 'month'
}