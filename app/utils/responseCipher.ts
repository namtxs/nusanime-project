function hexToBytes(hex: string) {
  const clean = hex.trim()
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function isEncryptedEnvelope(payload: unknown): payload is {
  enc: 1
  iv: string
  tag: string
  data: string
} {
  return !!payload
    && typeof payload === 'object'
    && (payload as { enc?: number }).enc === 1
    && typeof (payload as { iv?: unknown }).iv === 'string'
    && typeof (payload as { data?: unknown }).data === 'string'
}

export async function decryptResponse<T>(payload: T, keyHex: string): Promise<T> {
  if (!isEncryptedEnvelope(payload) || !keyHex) return payload

  const key = await crypto.subtle.importKey(
    'raw',
    hexToBytes(keyHex),
    'AES-GCM',
    false,
    ['decrypt']
  )

  const data = base64ToBytes(payload.data)
  const tag = base64ToBytes(payload.tag)
  const combined = new Uint8Array(data.length + tag.length)
  combined.set(data)
  combined.set(tag, data.length)

  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    key,
    combined
  )

  return JSON.parse(new TextDecoder().decode(plain)) as T
}
