import { contentService } from '~/services/contentService'
import { extractRelatedFromDetail } from '~/utils/apiNormalize'
import type { Anime } from '~/types/anime'

export const relatedService = {
  async getRelatedAnime(
    seasonId: string,
    detail?: unknown,
    _opts?: { episodeId?: string }
  ): Promise<{ data: Anime[]; title?: string }> {
    try {
      const items = await contentService.getRelatedOGV(String(seasonId))
      if (items.length) {
        return { data: items as Anime[] }
      }
    } catch {
      // fall through
    }

    const fromDetail = extractRelatedFromDetail(detail)
    if (fromDetail.length) {
      return { data: fromDetail as Anime[] }
    }

    return { data: [] }
  },
}
