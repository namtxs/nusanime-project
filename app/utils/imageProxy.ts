const IMAGE_HOSTS = [
  'pic.bstarstatic.com',
  'pic-bstarstatic.akamaized.net',
  'i0.hdslb.com',
]

export type ImageFit = 'portrait' | 'landscape'

export const IMAGE_FIT = {
  portrait: '@532w_710h_1e_1c_90q.webp',
  landscape: '@720w_405h_1e_1c_90q.webp',
} as const

export function applyImageFit(value: string, fit: ImageFit = 'portrait'): string {
  if (!value || value.includes('@')) return value

  const suffix = IMAGE_FIT[fit]
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const url = new URL(value)
      url.pathname = `${url.pathname}${suffix}`
      return url.toString()
    }
  } catch {
    // keep going
  }

  const q = value.indexOf('?')
  if (q === -1) return `${value}${suffix}`
  return `${value.slice(0, q)}${suffix}${value.slice(q)}`
}

export function proxiedImageUrl(
  original?: string | null,
  fit: ImageFit = 'portrait'
): string | undefined {
  if (!original) return undefined

  const apiOrigin = getApiOrigin()
  const apiBase = `${apiOrigin}/api`
  let resolved: string | undefined

  if (
    (original.startsWith('http://') || original.startsWith('https://')) &&
    original.includes('/api/proxy/image/')
  ) {
    try {
      const parsed = new URL(original)
      resolved = `${apiOrigin}${parsed.pathname}${parsed.search || ''}`
    } catch {
      const path = original.replace(/^https?:\/\/[^/]+/, '')
      resolved = `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`
    }
  } else if (original.startsWith('/api/proxy/image/')) {
    resolved = `${apiOrigin}${original}`
  } else if (original.startsWith('/proxy/image/')) {
    resolved = `${apiBase}${original}`
  } else if (
    original.startsWith('/ogv/') ||
    original.startsWith('/ugc/') ||
    original.startsWith('/bfs/') ||
    original.startsWith('ogv/') ||
    original.startsWith('ugc/') ||
    original.startsWith('bfs/')
  ) {
    const path = original.startsWith('/') ? original : `/${original}`
    resolved = getFullUrl(`/proxy/image${path}`)
  } else {
    try {
      const url = new URL(original)
      if (IMAGE_HOSTS.includes(url.hostname)) {
        resolved = `${getFullUrl('/proxy/image')}${url.pathname}${url.search || ''}`
      }
    } catch {
      if (
        original.includes('.png') ||
        original.includes('.jpg') ||
        original.includes('.jpeg') ||
        original.includes('.webp')
      ) {
        const path = original.startsWith('/') ? original : `/${original}`
        resolved = getFullUrl(`/proxy/image${path}`)
      } else {
        resolved = original
      }
    }
  }

  if (!resolved) resolved = original
  return applyImageFit(resolved, fit)
}

export function getCoverImageUrl(anime: {
  cover?: string
  square_cover?: string
  horizontal_cover?: string
}): string {
  return (
    proxiedImageUrl(
      anime.square_cover || anime.cover || anime.horizontal_cover,
      'portrait'
    ) || ''
  )
}

export function getBackdropImageUrl(original?: string | null): string {
  return proxiedImageUrl(original, 'landscape') || ''
}
