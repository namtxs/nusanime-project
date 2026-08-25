const IMAGE_HOSTS = [
  'pic.bstarstatic.com',
  'pic-bstarstatic.akamaized.net',
  'i0.hdslb.com',
]

export function proxiedImageUrl(original?: string | null): string | undefined {
  if (!original) return undefined

  const apiOrigin = useApiOrigin()
  const apiBase = useApiBase()

  if (
    (original.startsWith('http://') || original.startsWith('https://')) &&
    original.includes('/api/proxy/image/')
  ) {
    try {
      const parsed = new URL(original)
      return `${apiOrigin}${parsed.pathname}${parsed.search || ''}`
    } catch {
      const path = original.replace(/^https?:\/\/[^/]+/, '')
      return `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`
    }
  }

  if (original.startsWith('/api/proxy/image/')) {
    return `${apiOrigin}${original}`
  }

  if (original.startsWith('/proxy/image/')) {
    return `${apiBase}${original}`
  }

  if (
    original.startsWith('/ogv/') ||
    original.startsWith('/ugc/') ||
    original.startsWith('/bfs/') ||
    original.startsWith('ogv/') ||
    original.startsWith('ugc/') ||
    original.startsWith('bfs/')
  ) {
    const path = original.startsWith('/') ? original : `/${original}`
    return getFullUrl(`/proxy/image${path}`)
  }

  try {
    const url = new URL(original)
    if (IMAGE_HOSTS.includes(url.hostname)) {
      return `${getFullUrl('/proxy/image')}${url.pathname}${url.search || ''}`
    }
  } catch {
    if (
      original.includes('.png') ||
      original.includes('.jpg') ||
      original.includes('.jpeg') ||
      original.includes('.webp')
    ) {
      const path = original.startsWith('/') ? original : `/${original}`
      return getFullUrl(`/proxy/image${path}`)
    }
    return original
  }

  return original
}

export function getCoverImageUrl(anime: {
  cover?: string
  square_cover?: string
  horizontal_cover?: string
}): string {
  // Prefer square poster for card grids (matches Expo app)
  return (
    proxiedImageUrl(anime.square_cover || anime.cover || anime.horizontal_cover) ||
    ''
  )
}
