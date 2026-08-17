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

function episodeLabel(ep: any, index: number) {
  return ep.short_title || ep.episode_number || ep.index || index + 1
}

function episodeTitle(ep: any) {
  return formatEpisodeTitle(ep) || `Episode ${episodeLabel(ep, 0)}`
}

async function load() {
  if (!episodeId.value || !seasonId.value) {
    error.value = 'Missing season or episode'
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  relatedAnime.value = []
  try {
    const data = await contentService.getSeriesDetail(
      seasonId.value,
      episodeId.value
    )
    detail.value = data

    const sections = extractEpisodeSections(data)
    const currentSection =
      sections.find((s) =>
        s.episodes.some((ep) => String(ep.episode_id) === episodeId.value)
      ) || sections[0]
    activeSectionKey.value = currentSection?.key || sections[0]?.key || ''

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
    subtitles.value = isDracin.value ? [] : mapSubtitles(data.subtitles)
    if (!subtitles.value.length && !isDracin.value) {
      try {
        const fromApi = await contentService.getSubtitles(episodeId.value)
        subtitles.value = mapSubtitles(fromApi)
      } catch {
        // ignore
      }
    }

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

watch(detail, (data) => {
  if (!data) return
  ambient.setAmbient(
    pickHistoryImage(
      data.horizon_cover,
      data.horizontal_cover,
      data.cover,
      data.square_cover
    )
  )
})

onBeforeUnmount(() => ambient.clearAmbient())
</script>

<template>
  <div class="page watch">
    <header class="watch-head">
      <p class="watch-show">{{ title }}</p>
      <h1 class="watch-title">
        {{ epTitle }}
        <span
          v-if="isDracin"
          class="src-tag"
        >Dracin</span>
      </h1>
    </header>

    <LoadingState v-if="loading" />
    <ErrorState
      v-else-if="error"
      :message="error"
      @retry="load"
    />
    <template v-else>
      <div class="watch-stage">
        <div class="watch-main">
          <ClientOnly>
            <ExtensionGate>
              <DashPlayer
                v-if="streamUrl"
                :uri="streamUrl"
                :auto-play="store.autoPlay.value"
                :initial-position="initialPosition"
                :subtitles="subtitles"
                preferred-subtitle-lang="id"
                :qualities="qualities"
                :selected-quality="selectedQuality"
                :servers="SERVER_OPTIONS"
                :selected-server="store.preferredServer.value"
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

.watch-head {
  margin-bottom: 14px;
}

.watch-show {
  margin: 0 0 4px;
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

.watch-title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.src-tag {
  display: inline-block;
  margin-left: 8px;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  vertical-align: middle;
  background: var(--accent-soft);
  color: var(--accent);
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
  .watch-title {
    font-size: 1.125rem;
  }

  .ep-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
