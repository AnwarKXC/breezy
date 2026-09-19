'use client'

import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchPayments, createPaymentThunk, deletePaymentThunk, selectPayments } from '../store/accountingSlice'
import type { CreatePaymentInput } from '../types'

export function usePayments(invoiceId: string) {
  const dispatch = useAppDispatch()
  const allPayments = useAppSelector(selectPayments)
  const payments = allPayments[invoiceId] ?? []

  const load = useCallback(() => dispatch(fetchPayments(invoiceId)), [dispatch, invoiceId])

  const create = useCallback(
    (input: CreatePaymentInput) => dispatch(createPaymentThunk(input)).unwrap(),
    [dispatch],
  )

  const remove = useCallback(
    (id: string) => dispatch(deletePaymentThunk({ id, invoiceId })).unwrap(),
    [dispatch, invoiceId],
  )

  return { payments, load, create, remove }
}
