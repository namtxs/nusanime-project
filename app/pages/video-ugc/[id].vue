<script setup lang="ts">
import { contentService } from '~/services/contentService'
import { streamService } from '~/services/streamService'
import { SERVER_OPTIONS } from '~/utils/api'
import type { VideoQuality } from '~/types/anime'
import type { StreamServerKey } from '~/utils/api'

const route = useRoute()
const store = useAppStore()
store.hydrate()
const ambient = useAmbientBg()

const videoId = computed(() => String(route.params.id || ''))

const loading = ref(true)
const error = ref<string | null>(null)
const detail = ref<any>(null)
const qualities = ref<VideoQuality[]>([])
const selectedQuality = ref(2)
const streamUrl = ref('')
const related = ref<any[]>([])
const initialPosition = ref(0)

const title = computed(() => asDisplayText(detail.value?.title) || 'Video')
const ownerName = computed(() =>
  asDisplayText(detail.value?.owner?.name || detail.value?.owner?.uname)
)
const views = computed(() =>
  asDisplayText(detail.value?.stat_format?.view_count || detail.value?.stat?.view)
)
const desc = computed(() => asDisplayText(detail.value?.desc))

function relatedCover(item: any) {
  return (
    proxiedImageUrl(
      item.cover || item.horizontal_cover || item.square_cover || item.pic
    ) || ''
  )
}

function relatedTitle(item: any) {
  return asDisplayText(item.title) || 'Untitled'
}

function buildStream(quality: number) {
  selectedQuality.value = quality
  streamUrl.value = streamService.getUGCStreamUrl(
    videoId.value,
    quality,
    store.preferredServer.value
  )
}

async function load() {
  if (!videoId.value) {
    error.value = 'Missing video id'
    loading.value = false
    return
  }

  loading.value = true
  error.value = null
  streamUrl.value = ''
  related.value = []

  try {
    const data = await contentService.getVideoDetail(videoId.value)
    detail.value = data
    qualities.value = streamService.normalizeQualities(data?.quality_list)
    const q = streamService.pickQualityIndex(
      store.preferredQuality.value,
      qualities.value
    )
    selectedQuality.value = q
    buildStream(q)

    related.value = await contentService.getRelatedUGC(videoId.value)

    const hist = store.getHistoryItem(videoId.value)
    initialPosition.value = hist?.progress && hist.progress > 5 ? hist.progress : 0

    store.addToHistory({
      episode_id: videoId.value,
      season_id: videoId.value,
      title: asDisplayText(data?.title) || title.value,
      episode_title: ownerName.value || 'UGC',
      cover: pickHistoryImage(data?.cover, data?.pic),
      thumbnail: pickHistoryImage(data?.pic, data?.cover),
      progress: initialPosition.value,
      duration: Number(data?.duration || 0),
      watched_at: Date.now(),
      source: 'ugc',
    })
  } catch (e: any) {
    error.value = e?.message || 'Gagal memuat video'
  } finally {
    loading.value = false
  }
}

function onProgress(payload: { currentTime: number; duration: number }) {
  store.updateHistoryProgress(
    videoId.value,
    payload.currentTime,
    payload.duration
  )
}

function onQualityChange(key: number) {
  buildStream(key)
  store.setPreferredQuality(key)
}

function onServerChange(key: StreamServerKey) {
  store.setPreferredServer(key)
  buildStream(selectedQuality.value)
}

watch(videoId, () => {
  void load()
}, { immediate: true })

watch(detail, (data) => {
  if (!data) return
  ambient.setAmbient(pickHistoryImage(data.cover, data.pic, data.square_cover))
})

onBeforeUnmount(() => ambient.clearAmbient())
</script>

<template>
  <div class="page watch">
    <header class="watch-head">
      <p
        v-if="ownerName || views"
        class="watch-show"
      >
        <span v-if="ownerName">{{ ownerName }}</span>
        <span v-if="ownerName && views"> · </span>
        <span v-if="views">{{ views }} views</span>
      </p>
      <h1 class="watch-title">
        {{ title }}
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
                :qualities="qualities"
                :selected-quality="selectedQuality"
                :servers="SERVER_OPTIONS"
                :selected-server="store.preferredServer.value"
                @progress="onProgress"
                @quality-change="onQualityChange"
                @server-change="onServerChange"
              />
            </ExtensionGate>
            <template #fallback>
              <LoadingState message="Loading player…" />
            </template>
          </ClientOnly>

          <section
            v-if="desc"
            class="watch-desc"
          >
            <h2 class="section-title">Deskripsi</h2>
            <p class="desc">
              {{ desc }}
            </p>
          </section>
        </div>

        <aside
          v-if="related.length"
          class="watch-sidebar"
        >
          <div class="sidebar-head">
            <h2 class="sidebar-title">Related</h2>
            <p class="sidebar-sub">{{ related.length }}</p>
          </div>
          <div class="related-list">
            <button
              v-for="(item, idx) in related"
              :key="`${item.aid || item.oid || idx}`"
              type="button"
              class="related-row"
              @click="openTitle(item)"
            >
              <div class="related-thumb">
                <img
                  v-if="relatedCover(item)"
                  :src="relatedCover(item)"
                  :alt="relatedTitle(item)"
                  loading="lazy"
                >
              </div>
              <div class="related-meta">
                <div class="related-name">
                  {{ relatedTitle(item) }}
                </div>
                <div
                  v-if="item.subtitle"
                  class="related-sub"
                >
                  {{ item.subtitle }}
                </div>
              </div>
            </button>
          </div>
        </aside>
      </div>
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
  line-height: 1.25;
}

.watch-stage {
  display: grid;
  gap: 16px;
}

.watch-main {
  min-width: 0;
}

.watch-desc {
  margin-top: 20px;
}

.desc {
  margin: 0;
  color: var(--text-secondary);
  white-space: pre-wrap;
  line-height: 1.55;
  font-size: 0.9rem;
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

.related-list {
  overflow-y: auto;
  max-height: 420px;
  padding: 8px;
}

.related-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.related-row:hover {
  background: var(--bg-muted);
}

.related-row:hover .related-name {
  color: var(--accent);
}

.related-thumb {
  flex: 0 0 112px;
  width: 112px;
  height: 63px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-muted);
}

.related-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.related-meta {
  min-width: 0;
  flex: 1;
}

.related-name {
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.related-sub {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

  .related-list {
    max-height: none;
    flex: 1;
    min-height: 0;
  }
}

@media (max-width: 479px) {
  .watch-title {
    font-size: 1.125rem;
  }
}
</style>
