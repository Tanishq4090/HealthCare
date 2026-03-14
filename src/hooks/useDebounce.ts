import { useState, useEffect } from 'react'

/**
 * Custom hook to debounce a value.
 * @param value The value to be debounced.
 * @param delay The delay in milliseconds.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debounced
}
