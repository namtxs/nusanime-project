import type { Module, FeaturedItem } from '~/types/anime'

function normalizeModules(raw: unknown): Module[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (m): m is Module =>
      !!m &&
      typeof m === 'object' &&
      Array.isArray((m as Module).items) &&
      (m as Module).items.length > 0
  )
}

export const featuredService = {
  async getFeaturedList(): Promise<{ modules: Module[] }> {
    const response: any = await apiGet(API_ENDPOINTS.FEATURED)
    const modules = normalizeModules(response?.data?.modules ?? response?.modules)
    return { modules }
  },
}

export type { FeaturedItem, Module }
