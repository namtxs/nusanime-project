<script setup lang="ts">
import { animeService } from '~/services/animeService'
import { ANIME_GENRES } from '~/utils/genres'
import type { Anime } from '~/types/anime'

const route = useRoute()

const genre = ref(String(route.query.genre || 'semua'))
const page = ref(1)
const items = ref<Anime[]>([])
const total = ref(0)
const hasNext = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref<string | null>(null)

const activeLabel = computed(
  () => ANIME_GENRES.find((g) => g.key === genre.value)?.label || genre.value
)

const canLoadMore = computed(
  () => hasNext.value && !loading.value && !loadingMore.value
)

const totalLabel = computed(() => {
  if (loading.value && !items.value.length) return '…'
  if (total.value > 0) return total.value.toLocaleString('id-ID')
  return String(items.value.length)
})

async function load(reset = true) {
  if (reset) {
    loading.value = true
    page.value = 1
    items.value = []
  } else {
    if (loadingMore.value || !hasNext.value) return
    loadingMore.value = true
  }
  error.value = null
  try {
    const data = await animeService.getGenreItems(genre.value, page.value)
    items.value = reset ? data.items : [...items.value, ...data.items]
    hasNext.value = data.hasNext
    total.value = data.total
  } catch (e: any) {
    error.value = e?.message || 'Gagal memuat katalog'
    if (!reset) page.value = Math.max(1, page.value - 1)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function loadMore() {
  if (!canLoadMore.value) return
  page.value += 1
  void load(false)
}

function onGenreChange(key: string) {
  if (key === genre.value) return
  void navigateTo(
    { path: '/explore', query: { genre: key } },
    { replace: true }
  )
}

watch(
  () => String(route.query.genre || 'semua'),
  (next) => {
    if (next === genre.value && items.value.length > 0 && !loading.value) {
      return
    }
    genre.value = next
    void load(true)
  },
  { immediate: true }
)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">{{ activeLabel }}</h1>
    </div>
    <p class="page-lead">
      Index anime · {{ totalLabel }} judul
    </p>

    <div class="chips chips-wrap">
      <FilterChip
        v-for="item in ANIME_GENRES"
        :key="item.key"
        :label="item.label"
        :active="genre === item.key"
        @click="onGenreChange(item.key)"
      />
    </div>

    <LoadingState v-if="loading" />
    <ErrorState
      v-else-if="error"
      :message="error"
      @retry="load(true)"
    />
    <EmptyState
      v-else-if="!items.length"
      title="Tidak ada judul"
      message="Coba kategori lain."
    />
    <template v-else>
      <div class="grid-cards explore-grid">
        <AnimeCard
          v-for="(item, idx) in items"
          :key="`${item.season_id || item.aid || idx}`"
          :anime="item"
        />
      </div>
      <InfiniteSentinel
        :disabled="!canLoadMore"
        :loading="loadingMore"
        @visible="loadMore"
      />
    </template>
  </div>
</template>

<style scoped>
.explore-grid {
  gap: 16px 12px;
}

@media (min-width: 640px) {
  .explore-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 900px) {
  .explore-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .explore-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}

.explore-grid :deep(.title) {
  font-size: 0.8125rem;
}
</style>
