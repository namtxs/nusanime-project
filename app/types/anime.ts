export interface Anime {
  season_id?: string
  title: string
  cover?: string
  horizontal_cover?: string
  square_cover?: string
  subtitle?: string
  badge?: string
  badge_type?: number
  aid?: string
  oid?: string
  card_type?: string
  goto?: string
  source?: string
  [key: string]: unknown
}

export interface Episode {
  episode_id: string
  title: string
  title_display?: string
  long_title?: string
  cover?: string
  thumbnail?: string
  duration?: number
  index?: number
  [key: string]: unknown
}

export interface SeriesDetail {
  season_id: string
  title: string
  cover?: string
  horizon_cover?: string
  horizontal_cover?: string
  square_cover?: string
  evaluate?: string
  update_desc?: string
  sections?: {
    section?: Array<{
      title?: string
      start_ep_id?: number
      end_ep_id?: number
      size?: number
      ep_details?: Episode[]
    }>
  }
  details?: {
    vertical_cover?: string
    styles?: unknown
    desc?: { value?: string }
    union_info?: string[]
  }
  season_series?: Array<{ season_id: string; title: string }>
  seasons?: Array<{ season_id: string; title: string }>
  for_you?: { item_details?: unknown[] }
  subtitles?: Array<{
    id?: string
    subtitle_lang?: string
    lang?: string
    title?: string
    name?: string
    src?: string
    url?: string
    default?: boolean
  }>
  skip?: unknown
  quality_list?: VideoQuality[]
  [key: string]: unknown
}

export interface VideoQuality {
  key: number
  text: string
}

export interface FavoriteItem {
  season_id: string
  title: string
  cover?: string
  added_at: number
}

export interface WatchHistoryItem {
  episode_id: string
  season_id: string
  title: string
  episode_title?: string
  episode_number?: number
  thumbnail?: string
  cover?: string
  progress: number
  duration: number
  watched_at: number
  source?: string
}

export interface FeaturedItem {
  item_id?: number
  cover: string
  uri?: string
  title: string
  subtitle?: string
  season_id?: number | string
  aid?: number | string
}

export interface Module {
  module_id?: number | string
  style: string
  header?: { title: string; uri?: string }
  items: unknown[]
}
