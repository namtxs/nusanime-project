import { unmaskAesKey } from '~/utils/aesKeyMask'
import { decryptResponse } from '~/utils/responseCipher'

declare const __NUSA_A__: string | undefined
declare const __NUSA_B__: string | undefined
declare const __NUSA_C__: string | undefined
declare const __NUSA_D__: string | undefined

let apiOriginCache = ''
let responseAesKeyCache = ''

function bundledAesKey() {
  try {
    return unmaskAesKey([
      typeof __NUSA_A__ === 'string' ? __NUSA_A__ : '',
      typeof __NUSA_B__ === 'string' ? __NUSA_B__ : '',
      typeof __NUSA_C__ === 'string' ? __NUSA_C__ : '',
      typeof __NUSA_D__ === 'string' ? __NUSA_D__ : '',
    ])
  } catch {
    return ''
  }
}

export function hydrateApiConfig() {
  const config = useRuntimeConfig()
  apiOriginCache = String(config.public.apiOrigin || 'http://localhost:8989').replace(/\/$/, '')
  responseAesKeyCache = import.meta.server
    ? String(config.responseAesKey || bundledAesKey())
    : bundledAesKey()
  return { origin: apiOriginCache, aesKey: responseAesKeyCache }
}

export function getApiOrigin() {
  if (!apiOriginCache) hydrateApiConfig()
  return apiOriginCache
}

export function getResponseAesKey() {
  if (!responseAesKeyCache && !apiOriginCache) {
    try {
      hydrateApiConfig()
    } catch {
      // called outside Nuxt setup — keep empty until hydrated
    }
  }
  return responseAesKeyCache
}

export function useApiOrigin() {
  return hydrateApiConfig().origin
}

export function useApiBase() {
  return `${getApiOrigin()}/api`
}

export function getFullUrl(endpoint: string) {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${useApiBase()}${path}`
}

export function getAbsoluteUrl(path: string) {
  if (!path) return path
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getApiOrigin()}${normalized}`
}

export async function apiGet<T = unknown>(endpoint: string, opts?: { query?: Record<string, string | number | boolean | undefined> }) {
  const url = getFullUrl(endpoint)
  const key = getResponseAesKey()
  try {
    const raw = await $fetch<T>(url, {
      method: 'GET',
      query: opts?.query,
      timeout: 30000,
    })
    return await decryptResponse(raw, key)
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
