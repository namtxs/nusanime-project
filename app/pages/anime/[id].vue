<script setup lang="ts">
import { contentService } from '~/services/contentService'
import type { SeriesDetail } from '~/types/anime'

const route = useRoute()
const store = useAppStore()
store.hydrate()
const ambient = useAmbientBg()

const seasonId = computed(() => String(route.params.id || ''))

const loading = ref(true)
const error = ref<string | null>(null)
const detail = ref<SeriesDetail | null>(null)
const related = ref<any[]>([])
const sectionKey = ref('')

const sections = computed(() => (detail.value ? extractEpisodeSections(detail.value) : []))
const activeSection = computed(
  () => sections.value.find((s) => s.key === sectionKey.value) || sections.value[0]
)
const description = computed(() => (detail.value ? extractDescription(detail.value) : ''))
const styles = computed(() => (detail.value ? extractStyles(detail.value) : []))
const cover = computed(() => {
  if (!detail.value) return ''
  return (
    proxiedImageUrl(
      detail.value.details?.vertical_cover ||
        detail.value.cover ||
        detail.value.square_cover ||
        detail.value.horizontal_cover ||
        detail.value.horizon_cover
    ) || ''
  )
})
const hero = computed(() => {
  if (!detail.value) return ''
  return (
    proxiedImageUrl(
      detail.value.horizontal_cover ||
        detail.value.horizon_cover ||
        detail.value.cover ||
        detail.value.details?.vertical_cover
    ) || ''
  )
})
const favorited = computed(() => store.isFavorite(seasonId.value))
const seasons = computed(
  () => detail.value?.season_series || detail.value?.seasons || []
)

async function load() {
  if (!seasonId.value) return
  loading.value = true
  error.value = null
  try {
    const data = await contentService.getSeriesDetail(seasonId.value)
    detail.value = data
    const secs = extractEpisodeSections(data)
    sectionKey.value = secs[0]?.key || ''
    const fromDetail = extractRelatedFromDetail(data)
    related.value = fromDetail.length
      ? fromDetail
      : await contentService.getRelatedOGV(seasonId.value)
  } catch (e: any) {
    error.value = e?.message || 'Failed to load series'
  } finally {
    loading.value = false
  }
}

function toggleFavorite() {
  if (!detail.value) return
  if (favorited.value) {
    store.removeFromFavorites(seasonId.value)
  } else {
    store.addToFavorites({
      season_id: seasonId.value,
      title: detail.value.title,
      cover: cover.value || detail.value.cover,
    })
  }
}

function playEpisode(ep: any) {
  const epId = ep?.episode_id
  if (!epId) return
  const qs = new URLSearchParams({
    seasonId: seasonId.value,
  })
  if (isDracinSeriesDetail(detail.value)) {
    qs.set('source', 'dracin')
  }
  navigateTo(`/video/${epId}?${qs.toString()}`)
}

function playFirst() {
  const first = activeSection.value?.episodes?.[0] || extractEpisodes(detail.value)[0]
  if (first) playEpisode(first)
}

watch(seasonId, () => {
  void load()
}, { immediate: true })

watch(hero, (url) => ambient.setAmbient(url || cover.value), { immediate: true })
onBeforeUnmount(() => ambient.clearAmbient())
</script>

<template>
  <div class="page detail">
    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <template v-else-if="detail">
      <section class="hero">
        <img v-if="hero" class="hero-bg" :src="hero" :alt="detail.title" />
        <div class="hero-fade" />
        <div class="hero-body">
          <img v-if="cover" class="poster" :src="cover" :alt="detail.title" />
          <div class="info">
            <h1>{{ detail.title }}</h1>
            <p v-if="detail.update_desc" class="update">{{ detail.update_desc }}</p>
            <div v-if="styles.length" class="styles">{{ styles.join(' · ') }}</div>
            <div class="actions">
              <button class="btn btn-primary" type="button" @click="playFirst">Play</button>
              <button class="btn" type="button" @click="toggleFavorite">
                {{ favorited ? 'Saved' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="description" class="block">
        <h2 class="section-title">Synopsis</h2>
        <p class="desc">{{ description }}</p>
      </section>

      <section v-if="seasons.length > 1" class="block">
        <h2 class="section-title">Seasons</h2>
        <div class="chips">
          <NuxtLink
            v-for="s in seasons"
            :key="s.season_id"
            :to="`/anime/${s.season_id}`"
            class="season-chip"
            :class="{ active: String(s.season_id) === seasonId }"
          >
            {{ s.title }}
          </NuxtLink>
        </div>
      </section>

      <section class="block">
        <h2 class="section-title">Episodes</h2>
        <div v-if="sections.length > 1" class="chips">
          <FilterChip
            v-for="s in sections"
            :key="s.key"
            :label="s.title"
            :active="activeSection?.key === s.key"
            @click="sectionKey = s.key"
          />
        </div>
        <div class="ep-grid">
          <button
            v-for="ep in activeSection?.episodes || []"
            :key="ep.episode_id"
            type="button"
            class="ep"
            @click="playEpisode(ep)"
          >
            {{ ep.title_display || ep.title || ep.long_title || ep.episode_id }}
          </button>
        </div>
      </section>

      <section v-if="related.length" class="block">
        <h2 class="section-title">Related</h2>
        <div class="rail">
          <div
            v-for="(item, idx) in related"
            :key="`${item.season_id}-${idx}`"
            class="rail-item"
          >
            <AnimeCard :anime="item" />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-muted);
  margin-bottom: 24px;
  min-height: 260px;
}

.hero-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(2px);
  transform: scale(1.05);
}

.hero-fade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(var(--bg-rgb), 0.35), rgba(var(--bg-rgb), 0.92));
}

.hero-body {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 16px;
  padding: 24px;
  align-items: flex-end;
}

.poster {
  width: 120px;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

@media (min-width: 768px) {
  .poster {
    width: 160px;
  }
}

.info h1 {
  margin: 0 0 8px;
  font-size: clamp(1.25rem, 2.5vw, 1.875rem);
}

.update,
.styles {
  margin: 0 0 8px;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.block {
  margin-bottom: 28px;
}

.desc {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
  white-space: pre-wrap;
}

.season-chip {
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
}

.season-chip.active {
  border-color: var(--accent-border);
  color: var(--accent);
  background: var(--accent-soft);
}

.ep-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
}

.ep {
  padding: 10px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
}

.ep:hover {
  border-color: var(--accent-border);
  color: var(--accent);
}

.rail-item {
  flex: 0 0 140px;
}
</style>
