<script setup lang="ts">
import { contentService } from '~/services/contentService'
import { relatedService } from '~/services/relatedService'
import { resolveDracinServer, streamService } from '~/services/streamService'
import { SERVER_OPTIONS } from '~/utils/api'
import type { Anime, SeriesDetail, VideoQuality } from '~/types/anime'
import type { StreamServerKey } from '~/utils/api'

type DashSubtitleTrack = {
  url: string
  label?: string
  language?: string
  isDefault?: boolean
  type?: 'vtt' | 'srt' | 'ass' | 'auto'
}

const route = useRoute()
const store = useAppStore()
store.hydrate()
const ambient = useAmbientBg()

const episodeId = computed(() => String(route.params.episodeId || ''))
const seasonId = computed(() => String(route.query.seasonId || ''))
const contentSource = computed(() =>
  String(route.query.source || '').toLowerCase()
)
const isDracin = computed(() => contentSource.value === 'dracin')

const loading = ref(true)
const error = ref<string | null>(null)
const detail = ref<SeriesDetail | null>(null)
const qualities = ref<VideoQuality[]>([])
const selectedQuality = ref(2)
const streamUrl = ref('')
const subtitles = ref<DashSubtitleTrack[]>([])
const initialPosition = ref(0)
const relatedAnime = ref<Anime[]>([])
const relatedTitle = ref('More like this')
const activeSectionKey = ref('')
const epListRef = ref<HTMLElement | null>(null)
const sectionTrackRef = ref<HTMLElement | null>(null)

const episodeSections = computed(() =>
  detail.value ? extractEpisodeSections(detail.value) : []
)
const episodes = computed(() =>
  episodeSections.value.length === 1
    ? episodeSections.value[0]?.episodes || []
    : extractEpisodes(detail.value || {})
)
const visibleEpisodes = computed(() => {
  if (episodeSections.value.length <= 1) return episodes.value
  const section = episodeSections.value.find((s) => s.key === activeSectionKey.value)
  return section?.episodes || episodes.value
})
const showSectionTabs = computed(() => episodeSections.value.length > 1)
const activeSectionIndex = computed(() =>
  episodeSections.value.findIndex((s) => s.key === activeSectionKey.value)
)
const canPrevSection = computed(() => activeSectionIndex.value > 0)
const canNextSection = computed(
  () =>
    activeSectionIndex.value >= 0 &&
    activeSectionIndex.value < episodeSections.value.length - 1
)
const currentEp = computed(() =>
  episodes.value.find((e) => String(e.episode_id) === episodeId.value)
)
const title = computed(() => asDisplayText(detail.value?.title) || 'Now playing')
const epTitle = computed(() =>
  formatEpisodeTitle(currentEp.value as Record<string, unknown> | undefined)
)
const playerTitle = computed(() => {
  const show = title.value
  const ep = epTitle.value
  if (show && ep && ep !== show) return `${show} · ${ep}`
  return ep || show
})
const playerPoster = computed(() =>
  getBackdropImageUrl(
    pickHistoryImage(
      detail.value?.horizon_cover,
      detail.value?.horizontal_cover,
      detail.value?.cover,
      detail.value?.square_cover
    )
  )
)
const skipRanges = computed(() =>
  normalizeSkip(detail.value?.skip || (currentEp.value as { skip?: unknown } | undefined)?.skip)
)
const description = computed(() => (detail.value ? extractDescription(detail.value) : ''))
const descExpanded = ref(false)
const descTruncatable = computed(() => {
  const text = description.value.trim()
  if (!text) return false
  return text.length > 140 || text.split(/\n/).filter(Boolean).length > 3
})

function toggleDescription() {
  descExpanded.value = !descExpanded.value
}
function formatStatLabel(value: unknown, suffix: string) {
  const text = value != null ? String(value).trim() : ''
  if (!text) return ''
  if (new RegExp(suffix, 'i').test(text) || /ditonton|putar|suka|like|komentar|reply/i.test(text)) {
    return text
  }
  return `${text} ${suffix}`
}

const watchStats = computed(() => {
  const data = detail.value as Record<string, any> | null
  const stat = data?.stat || {}
  const items = [
    { key: 'views', label: formatStatLabel(stat.views || stat.view || data?.info?.play_num, 'Ditonton') },
    { key: 'likes', label: formatStatLabel(stat.likes || stat.like, 'Suka') },
  ]
  return items.filter((item) => item.label)
})
const updateSchedule = computed(() => {
  const data = detail.value as Record<string, any> | null
  const parts = String(data?.info?.union_info || '')
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
  const fromInfo = parts.find((part) =>
    /diperbarui|setiap\s+(senin|selasa|rabu|kamis|jumat|jum'?at|sabtu|minggu|hari)/i.test(part)
  )
  if (fromInfo) return fromInfo
  const desc = String(data?.update_desc || '').trim()
  if (/diperbarui|setiap\s+/i.test(desc) && !/^terbaru/i.test(desc)) return desc
  return ''
})
const seriesStatus = computed(() => {
  if (updateSchedule.value) return updateSchedule.value
  const data = detail.value as Record<string, any> | null
  const candidates = [
    String(data?.update_desc || '').trim(),
    ...(Array.isArray(data?.details?.union_info) ? data.details.union_info : []).map((item: unknown) =>
      String(item || '').trim()
    ),
  ].filter(Boolean)
  const finished = candidates.find((text) => /^tamat$/i.test(text) || /\btamat\b/i.test(text))
  if (finished) return 'Tamat'
  const upcoming = candidates.find((text) => /segera|akan tayang|coming soon/i.test(text))
  if (upcoming) return upcoming
  const latest = candidates.find((text) => /^terbaru/i.test(text))
  if (latest) return latest
  return candidates[0] || ''
})
const premiereText = computed(() => {
  const items = Array.isArray(detail.value?.details?.union_info)
    ? detail.value.details.union_info
    : []
  return items
    .map((item: unknown) => String(item || '').trim())
    .find((text) => /\d{1,2}\/\d{1,2}\/\d{2,4}.*tayang/i.test(text)) || ''
})
const remindText = computed(() =>
  String((detail.value as Record<string, any> | null)?.remind?.title || '').trim()
)
const isUpcomingRoute = computed(
  () => episodeId.value === 'soon' || episodeId.value === '-' || !episodeId.value
)
const isUpcoming = ref(false)

const styles = computed(() => (detail.value ? extractStyles(detail.value) : []))
const seasons = computed(
  () => detail.value?.season_series || detail.value?.seasons || []
)
const favorited = computed(() => store.isFavorite(seasonId.value))
const favoriteCover = computed(() =>
  pickHistoryImage(
    detail.value?.square_cover,
    detail.value?.cover,
    detail.value?.horizontal_cover,
    detail.value?.horizon_cover
  )
)
const infoCover = computed(() =>
  proxiedImageUrl(
    pickHistoryImage(
      detail.value?.details?.vertical_cover,
      detail.value?.square_cover,
      detail.value?.cover,
      detail.value?.horizontal_cover
    ),
    'portrait'
  ) || ''
)

function buildStream(quality: number) {
  selectedQuality.value = quality
  if (isDracin.value) {
    const server = resolveDracinServer(store.preferredServer.value)
    streamUrl.value = streamService.getDracinStreamUrl(
      seasonId.value,
      episodeId.value,
      quality,
      server
    )
    return
  }
  streamUrl.value = streamService.getOGVStreamUrl(
    episodeId.value,
    quality,
    store.preferredServer.value
  )
}

function mapSubtitles(list: any[] | undefined): DashSubtitleTrack[] {
  const seen = new Set<string>()
  const out: DashSubtitleTrack[] = []

  for (const s of list || []) {
    const rawSrc = s?.src || s?.url || ''
    if (!rawSrc) continue
    const url = getAbsoluteUrl(String(rawSrc))
    const language = String(s.subtitle_lang || s.lang || 'und')
    const key = `${language.toLowerCase()}|${url}`
    if (seen.has(key)) continue
    seen.add(key)

    out.push({
      url,
      label: String(s.title || s.name || s.subtitle_lang || language || 'Subtitle'),
      language,
      isDefault: !!s.default || String(s.subtitle_lang) === 'id',
      type: 'vtt',
    })
  }

  return out
}

function looksDubbed(data: any) {
  const text = [
    asDisplayText(data?.title),
    asDisplayText(data?.update_desc),
    ...(Array.isArray(data?.details?.union_info) ? data.details.union_info : []),
    ...extractStyles(data),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return /\bdub(\b|bing|\s*indo|\s*id)|\bdubbing|\bdubbed/.test(text)
}

function subtitlesFromPayload(data: any) {
  const ep = extractEpisodes(data).find(
    (e) => String(e.episode_id) === episodeId.value
  )
  return mapSubtitles([
    ...(Array.isArray(data?.subtitles) ? data.subtitles : []),
    ...(Array.isArray(ep?.subtitles) ? ep.subtitles : []),
  ])
}

async function resolveSubtitles(data: any) {
  const existing = subtitlesFromPayload(data)
  if (existing.length) return existing
  if (isDracin.value && looksDubbed(data)) return []
  try {
    return mapSubtitles(await contentService.getSubtitles(episodeId.value))
  } catch {
    return []
  }
}

function episodeLabel(ep: any, index: number) {
  return ep.short_title || ep.episode_number || ep.index || index + 1
}

function episodeTitle(ep: any) {
  return formatEpisodeTitle(ep) || `Episode ${episodeLabel(ep, 0)}`
}

async function load() {
  if (!seasonId.value) {
    error.value = 'Missing season'
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  relatedAnime.value = []
  isUpcoming.value = false
  streamUrl.value = ''
  try {
    const data = await contentService.getSeriesDetail(
      seasonId.value,
      isUpcomingRoute.value ? undefined : episodeId.value
    )
    detail.value = data

    const allEpisodes = extractEpisodes(data)
    const playable = pickPlayableEpisode(allEpisodes)
    if (isUpcomingRoute.value && playable?.episode_id) {
      const qs = new URLSearchParams({ seasonId: seasonId.value })
      if (isDracin.value) qs.set('source', 'dracin')
      await navigateTo(`/video/${playable.episode_id}?${qs.toString()}`, { replace: true })
      return
    }

    const sections = extractEpisodeSections(data)
    const currentSection =
      sections.find((s) =>
        s.episodes.some((ep) => String(ep.episode_id) === episodeId.value)
      ) || sections[0]
    activeSectionKey.value = currentSection?.key || sections[0]?.key || ''

    const upcomingTitle = /segera|akan tayang|coming soon/i.test(
      String(data.update_desc || '')
    )
    const noPlayable = !playable?.episode_id
    const noStream = !Array.isArray(data.quality_list) || data.quality_list.length === 0
    if (
      isUpcomingRoute.value ||
      noPlayable ||
      (noStream && (upcomingTitle || isPreviewEpisode(playable)))
    ) {
      isUpcoming.value = true
      qualities.value = []
      subtitles.value = []

      const relatedSoon = await relatedService
        .getRelatedAnime(seasonId.value, data)
        .catch(() => ({ data: [] as Anime[] }))
      relatedAnime.value = relatedSoon.data || []
      relatedTitle.value = relatedSoon.title || 'More like this'
      return
    }

    let available = streamService.normalizeQualities(data.quality_list)
    if (isDracin.value) {
      try {
        available = await streamService.getDracinQualities(
          seasonId.value,
          episodeId.value
        )
      } catch {
        // fallback to series list
      }
    }
    qualities.value = available

    const q = streamService.pickQualityIndex(
      store.preferredQuality.value,
      qualities.value
    )
    selectedQuality.value = q
    buildStream(q)
    subtitles.value = await resolveSubtitles(data)

    const related = await relatedService
      .getRelatedAnime(seasonId.value, data, { episodeId: episodeId.value })
      .catch(() => ({ data: [] as Anime[] }))
    relatedAnime.value = related.data || []
    relatedTitle.value = related.title || 'More like this'

    const hist = store.getHistoryItem(episodeId.value)
    initialPosition.value = hist?.progress && hist.progress > 5 ? hist.progress : 0

    const ep =
      extractEpisodes(data).find((e) => String(e.episode_id) === episodeId.value) ||
      currentEp.value
    store.addToHistory({
      episode_id: episodeId.value,
      season_id: seasonId.value,
      title: asDisplayText(data.title) || title.value || 'Untitled',
      episode_title: formatEpisodeTitle(ep as Record<string, unknown> | undefined),
      episode_number: Number(ep?.episode_number || ep?.short_title) || undefined,
      cover: pickHistoryImage(
        data.horizon_cover,
        data.horizontal_cover,
        data.square_cover,
        data.cover
      ),
      thumbnail: pickHistoryImage(
        ep?.horizontal_cover,
        ep?.horizon_cover,
        ep?.cover,
        data.horizon_cover,
        data.horizontal_cover,
        data.cover
      ),
      progress: initialPosition.value,
      duration: hist?.duration || 0,
      watched_at: Date.now(),
      ...(isDracin.value || hist?.source === 'dracin'
        ? { source: 'dracin' }
        : null),
    })
  } catch (e: any) {
    error.value = e?.message || 'Failed to load episode'
  } finally {
    loading.value = false
  }
  await nextTick()
  scrollActiveSectionIntoView()
  scrollActiveEpisodeIntoView()
}

function onProgress(payload: { currentTime: number; duration: number }) {
  store.updateHistoryProgress(episodeId.value, payload.currentTime, payload.duration)
}

function onQualityChange(key: number) {
  buildStream(key)
  store.setPreferredQuality(key)
}

function onServerChange(key: StreamServerKey) {
  store.setPreferredServer(key)
  buildStream(selectedQuality.value)
}

function playNext() {
  const idx = episodes.value.findIndex(
    (e) => String(e.episode_id) === episodeId.value
  )
  const next = episodes.value[idx + 1]
  if (!next) return
  const qs = new URLSearchParams({ seasonId: seasonId.value })
  if (isDracin.value) qs.set('source', 'dracin')
  navigateTo(`/video/${next.episode_id}?${qs.toString()}`)
}

function playEpisode(epId: string | number) {
  const qs = new URLSearchParams({ seasonId: seasonId.value })
  if (isDracin.value) qs.set('source', 'dracin')
  navigateTo(`/video/${epId}?${qs.toString()}`)
}

function toggleFavorite() {
  if (!detail.value || !seasonId.value) return
  if (favorited.value) {
    store.removeFromFavorites(seasonId.value)
    return
  }
  store.addToFavorites({
    season_id: seasonId.value,
    title: title.value,
    cover: favoriteCover.value || detail.value.cover,
  })
}

function openSeason(sid: string | number) {
  void openSeasonPlay(sid, {
    source: isDracin.value ? 'dracin' : undefined,
  }).catch((e) => {
    error.value = e?.message || 'Gagal membuka season'
  })
}

function selectSection(key: string) {
  activeSectionKey.value = key
  scrollActiveSectionIntoView()
}

function shiftSection(delta: number) {
  const next = episodeSections.value[activeSectionIndex.value + delta]
  if (!next) return
  selectSection(next.key)
}

function scrollActiveSectionIntoView() {
  nextTick(() => {
    const track = sectionTrackRef.value
    const chip = track?.querySelector<HTMLElement>('.section-pill.active')
    if (!track || !chip) return
    const left = chip.offsetLeft - (track.clientWidth - chip.offsetWidth) / 2
    track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  })
}

function scrollActiveEpisodeIntoView() {
  nextTick(() => {
    epListRef.value
      ?.querySelector('.ep-cell.active')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

watch([episodeId, visibleEpisodes], () => {
  scrollActiveEpisodeIntoView()
})

watch(activeSectionKey, () => {
  scrollActiveSectionIntoView()
})

watch([episodeId, seasonId, contentSource], () => {
  void load()
}, { immediate: true })

watch(description, () => {
  descExpanded.value = false
})

watch(detail, (data) => {
  if (!data) return
  ambient.setAmbient(
    getBackdropImageUrl(
      pickHistoryImage(
        data.horizon_cover,
        data.horizontal_cover,
        data.cover,
        data.square_cover
      )
    )
  )
})

onBeforeUnmount(() => ambient.clearAmbient())
</script>

<template>
  <div class="page watch">
    <LoadingState v-if="loading" />
    <ErrorState
      v-else-if="error"
      :message="error"
      @retry="load"
    />
    <template v-else>
      <div class="watch-stage">
        <div class="watch-main">
          <div
            v-if="isUpcoming"
            class="upcoming-stage"
          >
            <img
              v-if="playerPoster || infoCover"
              :src="playerPoster || infoCover"
              :alt="title"
            >
            <div class="upcoming-overlay">
              <p class="upcoming-kicker">Segera tayang</p>
              <h2 class="upcoming-title">{{ title }}</h2>
              <p
                v-if="premiereText"
                class="upcoming-date"
              >
                {{ premiereText }}
              </p>
              <p
                v-if="remindText"
                class="upcoming-remind"
              >
                {{ remindText }}
              </p>
            </div>
          </div>
          <ClientOnly v-else>
            <ExtensionGate>
              <DashPlayer
                v-if="streamUrl"
                :uri="streamUrl"
                :title="playerTitle"
                :poster="playerPoster"
                :auto-play="store.autoPlay.value"
                :initial-position="initialPosition"
                :subtitles="subtitles"
                preferred-subtitle-lang="id"
                :qualities="qualities"
                :selected-quality="selectedQuality"
                :servers="SERVER_OPTIONS"
                :selected-server="store.preferredServer.value"
                :skip="skipRanges"
                :auto-skip="store.skipIntro.value"
                @skip-change="store.setSkipIntro"
                @progress="onProgress"
                @quality-change="onQualityChange"
                @server-change="onServerChange"
                @ended="playNext"
              />
            </ExtensionGate>
            <template #fallback>
              <LoadingState message="Loading player…" />
            </template>
          </ClientOnly>

          <div
            v-if="watchStats.length || seriesStatus"
            class="watch-meta"
          >
            <p class="watch-stats">
              <span
                v-for="item in watchStats"
                :key="item.key"
                class="watch-stat"
                :data-key="item.key"
              >{{ item.label }}</span>
            </p>
            <p
              v-if="seriesStatus"
              class="watch-update-meta"
              :class="{ finished: /^tamat$/i.test(seriesStatus) }"
            >
              {{ seriesStatus }}
            </p>
          </div>

          <section
            v-if="detail"
            class="watch-info"
          >
            <div class="watch-info-row">
              <div
                v-if="infoCover"
                class="watch-cover"
              >
                <img
                  :src="infoCover"
                  :alt="title"
                >
              </div>
              <div class="watch-info-text">
                <div class="watch-info-head">
                  <div>
                    <h1 class="watch-show-title">{{ title }}</h1>
                    <div
                      v-if="styles.length"
                      class="watch-styles"
                    >
                      <span
                        v-for="style in styles"
                        :key="style"
                        class="genre-badge"
                      >{{ style }}</span>
                    </div>
                  </div>
                  <button
                    class="btn"
                    type="button"
                    @click="toggleFavorite"
                  >
                    {{ favorited ? 'Saved' : 'Save' }}
                  </button>
                </div>

                <div
                  v-if="description"
                  class="watch-desc-wrap"
                >
                  <p
                    class="watch-desc"
                    :class="{ clamped: !descExpanded && descTruncatable }"
                  >
                    {{ description }}
                  </p>
                  <button
                    v-if="descTruncatable"
                    type="button"
                    class="desc-more"
                    @click="toggleDescription"
                  >
                    {{ descExpanded ? 'View less' : 'View more' }}
                  </button>
                </div>
              </div>
            </div>

            <div
              v-if="seasons.length > 1"
              class="watch-seasons"
            >
              <h2 class="section-title">Season</h2>
              <div class="chips">
                <button
                  v-for="s in seasons"
                  :key="s.season_id"
                  type="button"
                  class="season-chip"
                  :class="{ active: String(s.season_id) === seasonId }"
                  @click="openSeason(s.season_id)"
                >
                  {{ s.title }}
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside class="watch-sidebar">
          <div class="sidebar-head">
            <h2 class="sidebar-title">Episode</h2>
            <p class="sidebar-sub">{{ episodes.length }}</p>
          </div>

          <div
            v-if="showSectionTabs"
            class="section-nav"
          >
            <button
              type="button"
              class="section-arrow"
              :disabled="!canPrevSection"
              aria-label="Section sebelumnya"
              @click="shiftSection(-1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M15 5.5 8.5 12 15 18.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <div
              ref="sectionTrackRef"
              class="sidebar-sections"
            >
              <button
                v-for="section in episodeSections"
                :key="section.key"
                type="button"
                class="section-pill"
                :class="{ active: activeSectionKey === section.key }"
                @click="selectSection(section.key)"
              >
                {{ section.title }}
              </button>
            </div>
            <button
              type="button"
              class="section-arrow"
              :disabled="!canNextSection"
              aria-label="Section berikutnya"
              @click="shiftSection(1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M9 5.5 15.5 12 9 18.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

          <div
            v-if="visibleEpisodes.length"
            ref="epListRef"
            class="ep-grid"
          >
            <button
              v-for="(ep, index) in visibleEpisodes"
              :key="ep.episode_id"
              type="button"
              class="ep-cell"
              :class="{ active: String(ep.episode_id) === episodeId }"
              :title="episodeTitle(ep)"
              @click="playEpisode(ep.episode_id)"
            >
              {{ episodeLabel(ep, index) }}
            </button>
          </div>
          <p
            v-else
            class="sidebar-empty"
          >
            {{ premiereText || 'Belum ada episode yang bisa diputar' }}
          </p>

          <p
            v-if="currentEp"
            class="sidebar-now"
          >
            Sedang tayang: {{ episodeTitle(currentEp) }}
          </p>
        </aside>
      </div>

      <section
        v-if="relatedAnime.length"
        class="watch-block related"
      >
        <h2 class="section-title">{{ relatedTitle }}</h2>
        <div class="grid-cards related-grid">
          <AnimeCard
            v-for="(item, idx) in relatedAnime"
            :key="`${item.season_id || item.oid || idx}`"
            :anime="item"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.watch {
  padding-top: 20px;
}

.watch-stage {
  display: grid;
  gap: 16px;
}

.watch-main {
  min-width: 0;
}

.watch-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  background: var(--bg-muted);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
}

.sidebar-sub {
  margin: 0;
  min-width: 28px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg);
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
}

.section-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 10px 0;
  flex-shrink: 0;
}

.section-arrow {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--bg);
  color: var(--text);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.section-arrow svg {
  width: 14px;
  height: 14px;
  display: block;
}

.section-arrow:hover:not(:disabled) {
  background: var(--border-subtle);
  color: var(--accent);
}

.section-arrow:disabled {
  opacity: 0.35;
  cursor: default;
}

.sidebar-sections {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  min-width: 0;
  flex: 1;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.sidebar-sections::-webkit-scrollbar {
  display: none;
}

.section-pill {
  flex: 0 0 auto;
  padding: 6px 11px;
  border-radius: 999px;
  border: 0;
  background: var(--bg);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  scroll-snap-align: start;
  cursor: pointer;
}

.section-pill.active,
.section-pill:hover {
  color: var(--on-accent);
  background: var(--accent);
}

.ep-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 14px 16px;
  overflow-y: auto;
  max-height: 420px;
  min-height: 0;
  flex: 1;
}

.ep-cell {
  min-height: 42px;
  padding: 10px 6px;
  border-radius: 8px;
  border: 0;
  background: var(--bg);
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.1;
  cursor: pointer;
}

.ep-cell:hover {
  color: var(--text);
  background: var(--border-subtle);
}

.ep-cell.active {
  background: var(--accent);
  color: var(--on-accent);
}

.sidebar-now {
  margin: 0;
  padding: 12px 16px 14px;
  border-top: 1px solid var(--border);
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.upcoming-stage {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-muted);
}

.upcoming-stage img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: saturate(0.92);
}

.upcoming-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 22px 22px 20px;
  background: linear-gradient(
    180deg,
    rgba(14, 14, 16, 0.18) 0%,
    rgba(14, 14, 16, 0.28) 42%,
    rgba(14, 14, 16, 0.88) 100%
  );
}

.upcoming-kicker {
  margin: 0 0 6px;
  color: #d2b8ff;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.upcoming-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.upcoming-date,
.upcoming-remind {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
}

.sidebar-empty {
  margin: 0;
  padding: 18px 16px 20px;
  color: var(--text-muted);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.watch-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.watch-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 650;
  line-height: 1.4;
}

.watch-stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.watch-stat::before {
  content: '';
  width: 14px;
  height: 14px;
  background: currentColor;
  -webkit-mask: var(--stat-icon) center / contain no-repeat;
  mask: var(--stat-icon) center / contain no-repeat;
}

.watch-stat[data-key='views'] {
  --stat-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E");
}

.watch-stat[data-key='likes'] {
  --stat-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 10v12'/%3E%3Cpath d='M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z'/%3E%3C/svg%3E");
}

.watch-update-meta {
  margin: 0;
  margin-left: auto;
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: right;
}

.watch-update-meta.finished {
  color: var(--accent);
}

.watch-info {
  margin-top: 16px;
}

.watch-info-row {
  display: flex;
  align-items: flex-start;
  gap: 18px;
}

.watch-cover {
  flex: 0 0 132px;
  width: 132px;
  aspect-ratio: 3 / 4.2;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-muted);
}

.watch-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.watch-info-text {
  min-width: 0;
  flex: 1;
}

.watch-info-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.watch-show-title {
  margin: 0 0 6px;
  font-size: 1.25rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.watch-update {
  margin: 0 0 8px;
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.watch-styles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0;
}

.genre-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid var(--accent-border);
  background: var(--accent-soft);
  color: #d2b8ff;
  font-size: 0.75rem;
  font-weight: 650;
  line-height: 1.2;
  white-space: nowrap;
}

.watch-desc-wrap {
  margin-top: 14px;
}

.watch-desc {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
  white-space: pre-wrap;
  font-size: 0.9rem;
}

.watch-desc.clamped {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  white-space: normal;
}

.desc-more {
  margin-top: 6px;
  border: 0;
  padding: 0;
  background: none;
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
}

.desc-more:hover {
  text-decoration: underline;
}

.watch-seasons {
  margin-top: 20px;
}

.season-chip {
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.season-chip.active {
  border-color: var(--accent-border);
  color: var(--accent);
  background: var(--accent-soft);
}

.watch-block {
  margin-top: 36px;
}

.related-grid {
  gap: 16px 12px;
}

@media (min-width: 640px) {
  .related-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 900px) {
  .related-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .related-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}

.related-grid :deep(.title) {
  font-size: 0.8125rem;
}

@media (min-width: 980px) {
  .watch-stage {
    grid-template-columns: minmax(0, 1fr) 320px;
    align-items: stretch;
  }

  .watch-sidebar {
    height: 0;
    min-height: 100%;
    max-height: none;
    position: static;
  }

  .ep-grid {
    max-height: none;
    flex: 1;
    min-height: 0;
    align-content: start;
  }
}

@media (max-width: 479px) {
  .ep-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .watch-info-row {
    gap: 12px;
  }

  .watch-cover {
    flex-basis: 92px;
    width: 92px;
  }
}
</style>
