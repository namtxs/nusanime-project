import type { Anime } from '~/types/anime'

export const animeService = {
  async getSchedule() {
    const response = await apiGet(API_ENDPOINTS.SCHEDULE)
    return unwrapSchedule(response)
  },

  async getGenreItems(genre: string, page = 1): Promise<{
    items: Anime[]
    hasNext: boolean
    total: number
  }> {
    const response = await apiGet(API_ENDPOINTS.INDEX_ANIME(genre, page))
    const data = unwrapData(response)
    const items = unwrapAnimeCards(response).map(mapCardToAnime).filter(Boolean) as Anime[]
    const flag = data?.has_next
    const hasNext =
      items.length === 0
        ? false
        : flag === undefined || flag === null
          ? true
          : Boolean(Number(flag))
    return {
      items,
      hasNext,
      total: Number(data?.total ?? items.length),
    }
  },

  async getTrending(type = 'umum'): Promise<{ title: string; items: Anime[] }> {
    const response: any = await apiGet(API_ENDPOINTS.TRENDING(type))
    const detail = response?.detail ?? unwrapData(response)?.detail ?? response
    const items = unwrapAnimeCards(detail?.items ?? detail)
      .map(mapCardToAnime)
      .filter(Boolean) as Anime[]
    return {
      title: detail?.title || detail?.name || response?.name || type,
      items,
    }
  },

  async getPremiumItems(page = 1): Promise<{ items: Anime[]; hasNext: boolean }> {
    const response = await apiGet(API_ENDPOINTS.PREMIUM(page))
    const data = unwrapData(response)
    const items = unwrapAnimeCards(response).map(mapCardToAnime).filter(Boolean) as Anime[]
    const flag = data?.has_next
    const hasNext =
      items.length === 0
        ? false
        : Boolean(Number(flag ?? (items.length >= 20 ? 1 : 0)))
    return { items, hasNext }
  },
}
