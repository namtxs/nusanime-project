import { decryptResponse, isEncryptedEnvelope } from '~/utils/responseCipher'

export default defineEventHandler(async (event) => {
  const rawPath = getRouterParam(event, 'path')
  const suffix = (Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || ''))
    .replace(/^\/+/, '')
  if (!suffix) {
    throw createError({ statusCode: 400, statusMessage: 'Missing API path' })
  }

  const config = useRuntimeConfig(event)
  const origin = String(config.public.apiOrigin || '').replace(/\/$/, '')
  if (!origin) {
    throw createError({
      statusCode: 500,
      statusMessage: 'NUXT_PUBLIC_API_ORIGIN belum di-set',
    })
  }

  let payload: unknown
  try {
    payload = await $fetch(`${origin}/api/${suffix}`, {
      query: getQuery(event),
      timeout: 30000,
    })
  } catch (err: any) {
    throw createError({
      statusCode: err?.statusCode || err?.status || 502,
      statusMessage:
        err?.data?.error || err?.data?.message || err?.message || 'Upstream API failed',
    })
  }

  if (!isEncryptedEnvelope(payload)) return payload

  const key = String(config.responseAesKey || '')
  if (!key) {
    throw createError({
      statusCode: 500,
      statusMessage: 'NUXT_RESPONSE_AES_KEY belum terbaca di server Nuxt (runtime)',
    })
  }

  try {
    return await decryptResponse(payload, key)
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Gagal mendekripsi respons API (kunci AES tidak cocok)',
    })
  }
})
