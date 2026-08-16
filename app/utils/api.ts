export type StreamServerKey =
  | 'avc_baseurl'
  | 'avc_backup_url'
  | 'hevc_baseurl'
  | 'hevc_backup_url'

export const SERVER_OPTIONS: { key: StreamServerKey; label: string }[] = [
  { key: 'avc_baseurl', label: 'Default' },
  { key: 'avc_backup_url', label: 'Server 1' },
  { key: 'hevc_baseurl', label: 'Server 2' },
  { key: 'hevc_backup_url', label: 'Server 3' },
]

export const VIDEO_QUALITY_OPTIONS = [
  { value: 0, label: '1080P HD' },
  { value: 1, label: '1080P' },
  { value: 2, label: '720P' },
  { value: 3, label: '480P' },
  { value: 4, label: '360P' },
] as const

export const API_ENDPOINTS = {
  FEATURED: '/featuredList',
  SCHEDULE: '/jadwalTayang',
  INDEX_ANIME: (genre: string, page: number) =>
    `/indexAnime/${encodeURIComponent(genre)}/${page}`,
  TRENDING: (type: string) => `/trending/${type}`,
  PREMIUM: (page: number) => `/premium/${page}`,
  SEARCH_SUGGEST: (keyword: string) =>
    `/search/suggestion/${encodeURIComponent(keyword)}`,
  SEARCH_ALL: (keyword: string, page: number) =>
    `/search/result-all/${encodeURIComponent(keyword)}/${page}`,
  SEARCH_ANIME: (keyword: string, page: number) =>
    `/search/result-anime/${encodeURIComponent(keyword)}/${page}`,
  SERIES: (seasonId: string, epId?: string) =>
    `/series/${seasonId}${epId ? `/${epId}` : ''}`,
  VIDEO: (epId: string) => `/videos/${epId}`,
  RELATED_UGC: (oid: string) => `/related/ugc/${oid}`,
  RELATED_OGV: (oid: string) => `/related/ogv/${oid}`,
  SUBTITLES: (epId: string) => `/related/subtitle/${epId}`,
  DRACIN_QUALITIES: (seasonId: string, epId: string) =>
    `/dracin/qualities/${seasonId}/${epId}`,
  DRACIN_STREAM_BASE: (seasonId: string, epId: string, quality: number) =>
    `/dracin/stream/base_url/${seasonId}/${epId}/${quality}.mpd`,
  DRACIN_STREAM_BACKUP: (seasonId: string, epId: string, quality: number) =>
    `/dracin/stream/backup_url/${seasonId}/${epId}/${quality}.mpd`,
  STREAM_OGV: {
    avc_baseurl: (epId: string, quality: number) =>
      `/dash/stream/avc_baseurl/${epId}/${quality}.mpd`,
    avc_backup_url: (epId: string, quality: number) =>
      `/dash/stream/avc_backup_url/${epId}/${quality}.mpd`,
    hevc_baseurl: (epId: string, quality: number) =>
      `/dash/stream/hevc_baseurl/${epId}/${quality}.mpd`,
    hevc_backup_url: (epId: string, quality: number) =>
      `/dash/stream/hevc_backup_url/${epId}/${quality}.mpd`,
  },
  STREAM_UGC: {
    avc_baseurl: (epId: string, quality: number) =>
      `/dash/ugc_stream/avc_baseurl/${epId}/${quality}.mpd`,
    avc_backup_url: (epId: string, quality: number) =>
      `/dash/ugc_stream/avc_backup_url/${epId}/${quality}.mpd`,
    hevc_baseurl: (epId: string, quality: number) =>
      `/dash/ugc_stream/hevc_baseurl/${epId}/${quality}.mpd`,
    hevc_backup_url: (epId: string, quality: number) =>
      `/dash/ugc_stream/hevc_backup_url/${epId}/${quality}.mpd`,
  },
} as const

export const API_TIMEOUT = 30000
