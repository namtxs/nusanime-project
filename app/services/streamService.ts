import type { StreamServerKey } from '~/utils/api'
import type { VideoQuality } from '~/types/anime'

export function resolveDracinServer(server: StreamServerKey): StreamServerKey {
  if (server === 'avc_backup_url' || server === 'hevc_backup_url') {
    return 'avc_backup_url'
  }
  return 'avc_baseurl'
}

export const streamService = {
  getOGVStreamUrl(
    epId: string,
    quality: number,
    server: StreamServerKey = 'avc_baseurl'
  ): string {
    const path = API_ENDPOINTS.STREAM_OGV[server](epId, quality)
    return getFullUrl(path)
  },

  getUGCStreamUrl(
    epId: string,
    quality: number,
    server: StreamServerKey = 'avc_baseurl'
  ): string {
    const path = API_ENDPOINTS.STREAM_UGC[server](epId, quality)
    return getFullUrl(path)
  },

  getDracinStreamUrl(
    seasonId: string,
    epId: string,
    quality: number,
    server: StreamServerKey = 'avc_baseurl'
  ): string {
    const useBackup =
      server === 'avc_backup_url' || server === 'hevc_backup_url'
    const path = useBackup
      ? API_ENDPOINTS.DRACIN_STREAM_BACKUP(seasonId, epId, quality)
      : API_ENDPOINTS.DRACIN_STREAM_BASE(seasonId, epId, quality)
    return getFullUrl(path)
  },

  async getDracinQualities(
    seasonId: string,
    epId: string
  ): Promise<VideoQuality[]> {
    try {
      const response: any = await apiGet(
        API_ENDPOINTS.DRACIN_QUALITIES(seasonId, epId)
      )
      const list = response?.quality ?? response?.data?.quality ?? []
      return this.normalizeQualities(list)
    } catch {
      return this.normalizeQualities(null)
    }
  },

  normalizeQualities(list?: VideoQuality[] | null): VideoQuality[] {
    if (list && list.length > 0) {
      return list.map((q) => ({
        key: typeof q.key === 'number' ? q.key : Number(q.key),
        text: q.text || `${q.key}`,
      }))
    }
    return [
      { key: 0, text: '360P' },
      { key: 1, text: '480P' },
      { key: 2, text: '720P' },
      { key: 3, text: '1080P' },
    ]
  },

  pickQualityIndex(preferred: number, available: VideoQuality[]): number {
    if (available.some((q) => q.key === preferred)) return preferred
    return available[available.length - 1]?.key ?? preferred
  },
}
