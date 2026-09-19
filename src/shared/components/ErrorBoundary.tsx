'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { sanitizeErrorMessage } from '@/shared/utils/sanitizeError'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-red-200 bg-[#FDEBEC] p-6">
          <p className="text-sm text-[#9F2F2D]">
            {sanitizeErrorMessage(this.state.error?.message)}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
