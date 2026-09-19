export interface DashboardMetricView {
  id: string
  label: string
  value: string
  helper: string
}

export interface DashboardProjectView {
  id: string
  title: string
  status: string
  summary: string
  step: string
}

export interface DashboardGoalView {
  id: string
  label: string
  done: boolean
}

export interface DashboardTaskView {
  id: string
  title: string
  dateLabel: string
  rotated?: boolean
}

export type Translate = (key: string) => string
