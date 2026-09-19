// 📁 src/shared/hooks/useLocalStorage.ts
import { useState } from 'react'

/**
 * LocalStorage hook - persists value in localStorage
 * @param key - Storage key
 * @param initialValue - Initial value if not stored
 * @returns [value, setValue, remove]
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch {
      setStoredValue(initialValue)
    }
  }

  const remove = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key)
      }
      setStoredValue(initialValue)
    } catch {
      setStoredValue(initialValue)
    }
  }

  return [storedValue, setValue, remove]
}
