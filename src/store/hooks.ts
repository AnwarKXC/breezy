// 📁 src/store/hooks.ts - Typed Redux hooks
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from './index'

/**
 * Typed dispatch hook
 * Use throughout app instead of plain useDispatch
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()

/**
 * Typed selector hook
 * Use throughout app instead of plain useSelector
 */
export const useAppSelector = useSelector.withTypes<RootState>()