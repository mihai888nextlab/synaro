import { useState, useEffect, useCallback } from 'react'
import { getProject, type Project } from '@/lib/api'

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getProject(id)
      setProject(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch project')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { project, loading, error, refetch: fetch }
}
