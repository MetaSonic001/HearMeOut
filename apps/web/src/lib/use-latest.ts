import { useEffect, useRef } from "react"

/** A ref that always holds the latest value, updated after render (safe to read in handlers/effects). */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}
