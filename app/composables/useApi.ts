export function useApiOrigin() {
  const config = useRuntimeConfig()
  return String(config.public.apiOrigin || 'http://localhost:8989').replace(/\/$/, '')
}

export function useApiBase() {
  return `${useApiOrigin()}/api`
}

export function getFullUrl(endpoint: string) {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${useApiBase()}${path}`
}

export function getAbsoluteUrl(path: string) {
  if (!path) return path
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${useApiOrigin()}${normalized}`
}

export async function apiGet<T = unknown>(endpoint: string, opts?: { query?: Record<string, string | number | boolean | undefined> }) {
  const url = getFullUrl(endpoint)
  try {
    return await $fetch<T>(url, {
      method: 'GET',
      query: opts?.query,
      timeout: 30000,
    })
  } catch (err: any) {
    const message =
      err?.data?.message ||
      err?.data?.error ||
      err?.message ||
      'Request failed'
    const error = new Error(message) as Error & { status?: number; data?: unknown }
    error.status = err?.statusCode || err?.status
    error.data = err?.data
    throw error
  }
}
