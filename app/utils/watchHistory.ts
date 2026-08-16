import type { WatchHistoryItem } from '~/types/anime'

export function asDisplayText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>
    for (const key of ['title', 'value', 'name', 'text', 'label']) {
      const inner = rec[key]
      if (typeof inner === 'string' && inner.trim()) return inner.trim()
    }
  }
  return ''
}

function asImage(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>
    const url = rec.url || rec.src || rec.cover
    if (typeof url === 'string' && url.trim()) return url.trim()
  }
  return ''
}

function isGenericEpisodeLabel(value: string): boolean {
  return (
    !value ||
    value === '[object Object]' ||
    /^\d+$/.test(value) ||
    /^e\s*\d+$/i.test(value) ||
    /^ep(?:isode)?\s*\d+$/i.test(value)
  )
}

function episodeNumberLabel(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return ''
  return `Episode ${num}`
}

export function pickHistoryImage(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const url = asImage(candidate)
    if (url) return url
  }
  return ''
}

export function formatEpisodeTitle(ep: Record<string, unknown> | null | undefined): string {
  if (!ep) return ''
  const long = asDisplayText(ep.long_title_display ?? ep.long_title)
  const display = asDisplayText(ep.title_display ?? ep.title)
  const numLabel = episodeNumberLabel(ep.episode_number ?? ep.short_title)

  if (long && !isGenericEpisodeLabel(long) && long !== display) return long
  if (display && !isGenericEpisodeLabel(display)) return display
  return numLabel || display || long
}

export function displayHistoryTitle(item: WatchHistoryItem): string {
  const title = asDisplayText(item.title)
  return title && title !== '[object Object]' ? title : 'Untitled'
}

export function displayHistoryEpisode(item: WatchHistoryItem): string {
  const ep = asDisplayText(item.episode_title)
  const title = asDisplayText(item.title)
  const numLabel = episodeNumberLabel(item.episode_number)

  if (ep && ep !== title && !isGenericEpisodeLabel(ep) && !/^episode\s+\d{6,}$/i.test(ep)) {
    return ep
  }
  if (numLabel) return numLabel
  if (ep && ep !== title) {
    const match = ep.match(/(\d+)/)
    if (match) return `Episode ${match[1]}`
  }
  return ''
}

export function sanitizeHistoryItem(item: WatchHistoryItem): WatchHistoryItem {
  return {
    ...item,
    episode_id: String(item.episode_id || ''),
    season_id: String(item.season_id || ''),
    title: displayHistoryTitle(item),
    episode_title: displayHistoryEpisode(item) || asDisplayText(item.episode_title) || undefined,
    thumbnail: pickHistoryImage(item.thumbnail, item.cover) || undefined,
    cover: pickHistoryImage(item.cover, item.thumbnail) || undefined,
    progress: Number(item.progress) || 0,
    duration: Number(item.duration) || 0,
    watched_at: Number(item.watched_at) || Date.now(),
  }
}

export function historyGroupKey(item: {
  season_id?: string
  episode_id?: string
  source?: string
}): string {
  const source = String(item.source || '').toLowerCase()
  const season = String(item.season_id || '').trim()
  const episode = String(item.episode_id || '').trim()
  if (source === 'ugc') return `ugc:${episode || season}`
  if (season) return `${source === 'dracin' ? 'dracin' : 'ogv'}:${season}`
  return episode ? `ep:${episode}` : ''
}

export function collapseWatchHistory(items: WatchHistoryItem[]): WatchHistoryItem[] {
  const map = new Map<string, WatchHistoryItem>()
  for (const raw of items) {
    if (!raw) continue
    const item = sanitizeHistoryItem(raw)
    const key = historyGroupKey(item)
    if (!key) continue
    const prev = map.get(key)
    if (!prev || item.watched_at >= prev.watched_at) {
      map.set(key, item)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.watched_at - a.watched_at)
}

export function isWatchFinished(item: WatchHistoryItem): boolean {
  if (!item.duration || item.duration <= 0) return false
  return item.progress / item.duration >= 0.92
}

export function progressPercent(item: WatchHistoryItem): number {
  if (!item.duration || item.duration <= 0) return 0
  return Math.min(100, Math.max(0, (item.progress / item.duration) * 100))
}

export function getContinueWatching(
  history: WatchHistoryItem[],
  limit = 20
): WatchHistoryItem[] {
  const bySeason = new Map<string, WatchHistoryItem>()

  for (const item of history) {
    if (!item?.season_id || !item?.episode_id) continue
    if (isWatchFinished(item)) continue

    const key = String(item.season_id)
    const prev = bySeason.get(key)
    if (!prev || item.watched_at > prev.watched_at) {
      bySeason.set(key, item)
    }
  }

  return Array.from(bySeason.values())
    .sort((a, b) => b.watched_at - a.watched_at)
    .slice(0, limit)
}

export function formatWatchTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export function formatRelativeWatchDate(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${Math.max(diffMins, 1)}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
