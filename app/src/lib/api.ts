export interface Project {
  id: string
  name: string
  description: string | null
  repositoryLocation: string | null
  environmentStatus: string
  createdAt: string
  updatedAt: string
  userId: string
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function getProjects(userId: string): Promise<Project[]> {
  return request<Project[]>(`/api/projects?userId=${encodeURIComponent(userId)}`)
}

export async function getProject(id: string): Promise<Project> {
  return request<Project>(`/api/projects/${encodeURIComponent(id)}`)
}

export async function createProject(data: { name: string; description?: string; userId: string }): Promise<Project> {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  return request<Project>(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteProject(id: string): Promise<void> {
  return request<void>(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
