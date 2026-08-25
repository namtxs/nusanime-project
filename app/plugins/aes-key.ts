import { maskAesKey } from '~/utils/aesKeyMask'

export default defineNuxtPlugin(() => {
  const parts = useState<[string, string, string, string]>('nusaAesKeyParts', () => [
    '',
    '',
    '',
    '',
  ])
  if (!import.meta.server) return
  const key = String(useRuntimeConfig().responseAesKey || '')
  if (key) parts.value = maskAesKey(key)
})
