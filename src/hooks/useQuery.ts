import { useCallback, useEffect, useRef, useState } from 'react'
import type { DependencyList } from 'react'
import { errorMessage } from '../lib/utils'

export function useQuery<T>(loader: () => Promise<T>, deps: DependencyList, initial: T) {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const hasLoaded = useRef(false)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    let active = true
    if (!hasLoaded.current) setLoading(true)
    setError(null)
    loaderRef
      .current()
      .then((result) => {
        if (!active) return
        setData(result)
        hasLoaded.current = true
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])

  return { data, setData, loading, error, reload }
}
