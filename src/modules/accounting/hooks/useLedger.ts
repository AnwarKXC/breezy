'use client'

import { useEffect, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchLedgerEntriesData, selectLedgerEntries, selectAccountingLoading } from '../store/accountingSlice'

export function useLedger(filters?: Record<string, string>) {
  const dispatch = useAppDispatch()
  const ledgerEntries = useAppSelector(selectLedgerEntries)
  const loading = useAppSelector(selectAccountingLoading)

  useEffect(() => {
    dispatch(fetchLedgerEntriesData(filters))
  }, [dispatch, JSON.stringify(filters)])

  const load = useCallback((params?: Record<string, string>) => dispatch(fetchLedgerEntriesData(params)), [dispatch])

  return { ledgerEntries, loading, load }
}
