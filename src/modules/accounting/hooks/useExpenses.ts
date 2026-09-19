'use client'

import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchExpensesData, createExpenseThunk, createExpenseCategoryThunk, deleteExpenseCategoryThunk, deleteExpenseThunk, fetchExpenseCategoriesData, selectExpenses, selectExpenseCategories } from '../store/accountingSlice'
import type { CreateExpenseInput, CreateExpenseCategoryInput } from '../types'

export function useExpenses(filters?: { month?: string; fromDate?: string; toDate?: string }) {
  const dispatch = useAppDispatch()
  const expenses = useAppSelector(selectExpenses)
  const expenseCategories = useAppSelector(selectExpenseCategories)

  useEffect(() => {
    dispatch(fetchExpenseCategoriesData())
  }, [dispatch])

  useEffect(() => {
    const params: Record<string, string | undefined> = {}
    if (filters?.month) params.month = filters.month
    if (filters?.fromDate) params.fromDate = filters.fromDate
    if (filters?.toDate) params.toDate = filters.toDate
    dispatch(fetchExpensesData(Object.keys(params).length ? params : undefined))
  }, [dispatch, filters?.month, filters?.fromDate, filters?.toDate])

  const create = (input: CreateExpenseInput) => dispatch(createExpenseThunk(input)).unwrap()
  const createCategory = (input: CreateExpenseCategoryInput) => dispatch(createExpenseCategoryThunk(input)).unwrap()
  const remove = (id: string) => dispatch(deleteExpenseThunk(id)).unwrap()
  const removeCategory = (id: string) => dispatch(deleteExpenseCategoryThunk(id)).unwrap()

  return { expenses, expenseCategories, create, createCategory, remove, removeCategory }
}
