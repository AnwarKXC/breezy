'use client'

import { useEffect, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchAccountingOverviewData, selectOverview, selectAccountingLoading } from '../store/accountingSlice'

export function useAccountingOverview() {
  const dispatch = useAppDispatch()
  const overview = useAppSelector(selectOverview)
  const loading = useAppSelector(selectAccountingLoading)

  useEffect(() => {
    dispatch(fetchAccountingOverviewData())
  }, [dispatch])

  const refresh = useCallback(() => dispatch(fetchAccountingOverviewData()), [dispatch])

  return { overview, loading, refresh }
}
