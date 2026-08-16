import type { FavoriteItem, WatchHistoryItem } from '~/types/anime'
import type { StreamServerKey } from '~/utils/api'
import { collapseWatchHistory, historyGroupKey, pickHistoryImage, sanitizeHistoryItem } from '~/utils/watchHistory'

interface AppSettings {
  preferredQuality: number
  preferredServer: StreamServerKey
  autoPlay: boolean
  skipIntro: boolean
}

const FAVORITES_KEY = '@nusanime_favorites'
const HISTORY_KEY = '@nusanime_history'
const SETTINGS_KEY = '@nusanime_settings'

const DEFAULT_SETTINGS: AppSettings = {
  preferredQuality: 2,
  preferredServer: 'avc_baseurl',
  autoPlay: true,
  skipIntro: true,
}

function readJson<T>(key: string, fallback: T): T {
  if (!import.meta.client) return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

const favorites = ref<FavoriteItem[]>([])
const watchHistory = ref<WatchHistoryItem[]>([])
const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
const hydrated = ref(false)

let progressTimer: ReturnType<typeof setTimeout> | null = null
let pendingProgress: { episodeId: string; progress: number; duration: number } | null = null

export function useAppStore() {
  const hydrate = () => {
    if (!import.meta.client || hydrated.value) return
    favorites.value = readJson(FAVORITES_KEY, [])
    const next = collapseWatchHistory(
      readJson<WatchHistoryItem[]>(HISTORY_KEY, [])
    )
    watchHistory.value = next
    writeJson(HISTORY_KEY, next)
    settings.value = { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_KEY, {}) }
    hydrated.value = true
  }

  const addToFavorites = (item: Partial<FavoriteItem> & { season_id: string; title: string }) => {
    hydrate()
    const favoriteItem: FavoriteItem = {
      season_id: String(item.season_id),
      title: item.title,
      cover: item.cover,
      added_at: Date.now(),
    }
    favorites.value = [
      favoriteItem,
      ...favorites.value.filter((f) => f.season_id !== favoriteItem.season_id),
    ]
    writeJson(FAVORITES_KEY, favorites.value)
  }

  const removeFromFavorites = (seasonId: string) => {
    hydrate()
    const id = String(seasonId)
    favorites.value = favorites.value.filter((f) => f.season_id !== id)
    writeJson(FAVORITES_KEY, favorites.value)
  }

  const isFavorite = (seasonId: string) =>
    favorites.value.some((f) => f.season_id === String(seasonId))

  const addToHistory = (item: WatchHistoryItem) => {
    hydrate()
    const key = historyGroupKey(item)
    const existing = watchHistory.value.find((h) => historyGroupKey(h) === key)
    const normalized = sanitizeHistoryItem({
      ...existing,
      ...item,
      episode_id: String(item.episode_id),
      season_id: String(item.season_id || existing?.season_id || ''),
      source: item.source || existing?.source,
      cover: pickHistoryImage(item.cover, existing?.cover),
      thumbnail: pickHistoryImage(item.thumbnail, existing?.thumbnail, item.cover, existing?.cover),
    })
    watchHistory.value = [
      normalized,
      ...watchHistory.value.filter((h) => historyGroupKey(h) !== key),
    ].slice(0, 100)
    writeJson(HISTORY_KEY, watchHistory.value)
  }

  const flushProgress = () => {
    const pending = pendingProgress
    pendingProgress = null
    if (!pending || !hydrated.value) return
    const { episodeId, progress, duration } = pending
    const existing = watchHistory.value.find((h) => h.episode_id === episodeId)
    if (!existing) return
    const updated: WatchHistoryItem = {
      ...existing,
      progress,
      duration,
      watched_at: Date.now(),
    }
    const key = historyGroupKey(updated)
    watchHistory.value = [
      updated,
      ...watchHistory.value.filter((h) => historyGroupKey(h) !== key),
    ].slice(0, 100)
    writeJson(HISTORY_KEY, watchHistory.value)
  }

  const updateHistoryProgress = (episodeId: string, progress: number, duration: number) => {
    hydrate()
    pendingProgress = { episodeId: String(episodeId), progress, duration }
    if (progressTimer) clearTimeout(progressTimer)
    progressTimer = setTimeout(() => flushProgress(), 4000)
  }

  const removeFromHistory = (episodeId: string) => {
    hydrate()
    const id = String(episodeId)
    watchHistory.value = watchHistory.value.filter((h) => h.episode_id !== id)
    writeJson(HISTORY_KEY, watchHistory.value)
  }

  const clearHistory = () => {
    hydrate()
    watchHistory.value = []
    if (import.meta.client) localStorage.removeItem(HISTORY_KEY)
  }

  const getHistoryItem = (episodeId: string) =>
    watchHistory.value.find((h) => h.episode_id === String(episodeId))

  const patchSettings = (partial: Partial<AppSettings>) => {
    hydrate()
    settings.value = { ...settings.value, ...partial }
    writeJson(SETTINGS_KEY, settings.value)
  }

  return {
    hydrated,
    favorites,
    watchHistory,
    preferredQuality: computed(() => settings.value.preferredQuality),
    preferredServer: computed(() => settings.value.preferredServer),
    autoPlay: computed(() => settings.value.autoPlay),
    skipIntro: computed(() => settings.value.skipIntro),
    hydrate,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    addToHistory,
    updateHistoryProgress,
    removeFromHistory,
    clearHistory,
    getHistoryItem,
    setPreferredQuality: (quality: number) => patchSettings({ preferredQuality: quality }),
    setPreferredServer: (server: StreamServerKey) => patchSettings({ preferredServer: server }),
    setAutoPlay: (value: boolean) => patchSettings({ autoPlay: value }),
    setSkipIntro: (value: boolean) => patchSettings({ skipIntro: value }),
  }
}
