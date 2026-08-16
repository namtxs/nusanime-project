export type KeywordSuggestion = {
  keyword: string
  type?: string
  match?: Array<{ str: string; match: boolean }>
}

export type SearchListPage = {
  items: any[]
  hasNext: boolean
}

function isUgcModule(type?: string) {
  return String(type || '').toLowerCase().includes('ugc')
}

function isAnimeModule(type?: string) {
  const t = String(type || '').toLowerCase()
  return t.includes('ogv') || t.includes('anime')
}

/**
 * Mirrors Expo searchService:
 * - suggestion → /search/suggestion/:q
 * - anime → /search/result-anime/:q/:page
 * - ugc videos → /search/result-all/:q/:page (UGC modules only)
 */
export const searchService = {
  async getSuggestions(keyword: string): Promise<KeywordSuggestion[]> {
    try {
      if (!keyword?.trim()) return []
      const response = await apiGet(API_ENDPOINTS.SEARCH_SUGGEST(keyword.trim()))
      return unwrapSuggestions(response)
    } catch (error) {
      console.error('Error fetching search suggestions:', error)
      return []
    }
  },

  async searchAnime(keyword: string, page = 1): Promise<SearchListPage> {
    if (!keyword?.trim()) throw new Error('Search keyword is required')
    const response = await apiGet(
      API_ENDPOINTS.SEARCH_ANIME(keyword.trim(), page)
    )
    const data = unwrapData(response)
    const fromItems = asArray(data?.items).map(mapCardToAnime).filter(Boolean)
    if (fromItems.length) {
      return {
        items: fromItems,
        hasNext: Boolean(Number(data?.has_next ?? 0)),
      }
    }
    const { modules, hasNext } = unwrapSearchModules(response)
    return {
      items: modules
        .filter((m) => isAnimeModule(m.type))
        .flatMap((m) => m.items),
      hasNext,
    }
  },

  async searchUgc(keyword: string, page = 1): Promise<SearchListPage> {
    if (!keyword?.trim()) throw new Error('Search keyword is required')
    const response = await apiGet(
      API_ENDPOINTS.SEARCH_ALL(keyword.trim(), page)
    )
    const data = unwrapData(response)
    const modules = asArray(data?.modules)

    const ugcItems = modules
      .filter((m: any) => isUgcModule(m?.type))
      .flatMap((m: any) => asArray(m?.items))
      .map(mapCardToAnime)
      .filter(Boolean)

    const fallback =
      ugcItems.length === 0
        ? modules
            .flatMap((m: any) => asArray(m?.items))
            .filter((it: any) => it?.aid && !it?.season_id)
            .map(mapCardToAnime)
            .filter(Boolean)
        : ugcItems

    return {
      items: fallback,
      hasNext: Boolean(Number(data?.has_next ?? 0)),
    }
  },
}
