import { maskAesKey } from '~/utils/aesKeyMask'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const key = String(config.responseAesKey || '')
  if (!key) return
  config.public.aesKeyParts = maskAesKey(key)
})
