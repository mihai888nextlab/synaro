import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { getProjects, type Project } from '@/lib/api'

export function useProjects() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    const userId = session?.user?.id
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getProjects(userId)
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { projects, loading, error, refetch: fetch }
}
