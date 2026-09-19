// 📁 src/modules/dashboard/types.ts - Dashboard module types
/**
 * Dashboard module type definitions
 * Following project structure RTK guidelines
 */

// Analytics card data
export interface AnalyticsCard {
  id: string
  title: string
  value: number | string
  change?: number // percentage change
  trend?: 'up' | 'down' | 'neutral'
  icon?: string // Icon name (e.g., "dollar", "users")
}

// Revenue stats
export interface RevenueStats {
  total: number
  today: number
  week: number
  month: number
}

// Occupancy data
export interface OccupancyData {
  available: number
  occupied: number
  maintenance: number
  total: number
}

// Recent activity item
export interface ActivityItem {
  id: string
  type: 'booking' | 'checkin' | 'checkout' | 'payment'
  description: string
  timestamp: Date
  guestName?: string
}

// Dashboard filters
export interface DashboardFilters {
  dateRange: 'today' | 'week' | 'month' | 'year'
  type?: 'all' | 'revenue' | 'bookings' | 'occupancy'
}