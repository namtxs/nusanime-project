const MIX = [90, 60, 145, 231, 20, 184, 98, 13, 201, 47, 176, 83]

function hexToBytes(hex: string): number[] {
  const clean = hex.trim()
  const out: number[] = []
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out.push(Number.parseInt(clean.slice(i, i + 2), 16))
  }
  return out
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function bytesToB64(bytes: number[]): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let raw = ''
  for (const byte of bytes) raw += String.fromCharCode(byte)
  return btoa(raw)
}

function b64ToBytes(value: string): number[] {
  if (typeof Buffer !== 'undefined') return Array.from(Buffer.from(value, 'base64'))
  const raw = atob(value)
  const out: number[] = []
  for (let i = 0; i < raw.length; i++) out.push(raw.charCodeAt(i))
  return out
}

export function maskAesKey(hex: string): [string, string, string, string] {
  if (!hex) return ['', '', '', '']
  const mixed = hexToBytes(hex).map(
    (byte, index) => byte ^ MIX[index % MIX.length] ^ (index * 7 + 11)
  )
  const encoded = bytesToB64(mixed)
  const size = Math.ceil(encoded.length / 4) || 1
  return [
    encoded.slice(0, size),
    encoded.slice(size, size * 2),
    encoded.slice(size * 2, size * 3),
    encoded.slice(size * 3),
  ]
}

export function unmaskAesKey(parts: string[]): string {
  const encoded = parts.join('')
  if (!encoded) return ''
  return bytesToHex(
    b64ToBytes(encoded).map((byte, index) => byte ^ MIX[index % MIX.length] ^ (index * 7 + 11))
  )
}
