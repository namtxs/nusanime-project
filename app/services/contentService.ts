import type { SeriesDetail } from '~/types/anime'

export const contentService = {
  async getSeriesDetail(seasonId: string, epId?: string): Promise<SeriesDetail> {
    return apiGet<SeriesDetail>(API_ENDPOINTS.SERIES(seasonId, epId))
  },

  async getSubtitles(epId: string): Promise<any[]> {
    const response: any = await apiGet(API_ENDPOINTS.SUBTITLES(epId))
    return response?.data || response || []
  },

  async getVideoDetail(epId: string): Promise<any> {
    const response: any = await apiGet(API_ENDPOINTS.VIDEO(epId))
    return response?.data ?? response
  },

  async getRelatedOGV(oid: string): Promise<any[]> {
    try {
      const ogv = await apiGet(API_ENDPOINTS.RELATED_OGV(oid))
      return unwrapRelated(ogv)
    } catch {
      return []
    }
  },

  async getRelatedUGC(oid: string): Promise<any[]> {
    try {
      const ugc = await apiGet(API_ENDPOINTS.RELATED_UGC(oid))
      return unwrapRelated(ugc)
    } catch {
      return []
    }
  },
}
