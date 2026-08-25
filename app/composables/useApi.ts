import { unmaskAesKey } from '~/utils/aesKeyMask'
import { decryptResponse, isEncryptedEnvelope } from '~/utils/responseCipher'

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

function resolveResponseAesKey() {
  const config = useRuntimeConfig()
  const serverKey = String(config.responseAesKey || '')
  if (serverKey) return serverKey
  const parts = useState<[string, string, string, string]>('nusaAesKeyParts')
  return unmaskAesKey(parts.value || [])
}

async function unwrapApiPayload<T>(raw: T): Promise<T> {
  if (!isEncryptedEnvelope(raw)) return raw
  const key = resolveResponseAesKey()
  if (!key) {
    throw new Error('API terenkripsi, tapi NUXT_RESPONSE_AES_KEY belum di-set')
  }
  try {
    return await decryptResponse(raw, key)
  } catch {
    throw new Error('Gagal mendekripsi respons API (kunci AES tidak cocok)')
  }
}

export async function apiGet<T = unknown>(endpoint: string, opts?: { query?: Record<string, string | number | boolean | undefined> }) {
  const url = getFullUrl(endpoint)
  try {
    const raw = await $fetch<T>(url, {
      method: 'GET',
      query: opts?.query,
      timeout: 30000,
    })
    return await unwrapApiPayload(raw)
  } catch (err: any) {
    const message =
      err?.data?.message ||
      err?.data?.error ||
      err?.statusMessage ||
      err?.message ||
      'Request failed'
    const error = new Error(message) as Error & { status?: number; data?: unknown }
    error.status = err?.statusCode || err?.status
    error.data = err?.data
    throw error
  }
}
