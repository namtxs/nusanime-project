<script setup lang="ts">
import { searchService } from '~/services/searchService'
import type { Anime } from '~/types/anime'

type TabKey = 'anime' | 'videos'

const route = useRoute()
const keyword = computed(() => String(route.query.q || '').trim())

const tab = ref<TabKey>('anime')
const animeItems = ref<Anime[]>([])
const videoItems = ref<Anime[]>([])
const animePage = ref(1)
const videoPage = ref(1)
const animeHasNext = ref(false)
const videoHasNext = ref(false)
const animeLoaded = ref(false)
const videoLoaded = ref(false)

const initialLoading = ref(true)
const tabLoading = ref(false)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const fetching = ref(false)

const items = computed(() =>
  tab.value === 'anime' ? animeItems.value : videoItems.value
)
const hasNext = computed(() =>
  tab.value === 'anime' ? animeHasNext.value : videoHasNext.value
)
const canLoadMore = computed(
  () =>
    !!keyword.value &&
    hasNext.value &&
    !initialLoading.value &&
    !tabLoading.value &&
    !loadingMore.value
)

async function loadAnime(page: number, append: boolean) {
  if (!keyword.value) return
  const pageData = await searchService.searchAnime(keyword.value, page)
  animeItems.value = append
    ? [...animeItems.value, ...pageData.items]
    : pageData.items
  animePage.value = page
  animeHasNext.value = pageData.hasNext && pageData.items.length > 0
  animeLoaded.value = true
}

async function loadVideos(page: number, append: boolean) {
  if (!keyword.value) return
  const pageData = await searchService.searchUgc(keyword.value, page)
  videoItems.value = append
    ? [...videoItems.value, ...pageData.items]
    : pageData.items
  videoPage.value = page
  videoHasNext.value = pageData.hasNext && pageData.items.length > 0
  videoLoaded.value = true
}

async function bootstrap() {
  if (!keyword.value) {
    animeItems.value = []
    videoItems.value = []
    initialLoading.value = false
    return
  }

  try {
    initialLoading.value = true
    error.value = null
    animeLoaded.value = false
    videoLoaded.value = false
    animeItems.value = []
    videoItems.value = []
    animePage.value = 1
    videoPage.value = 1
    animeHasNext.value = false
    videoHasNext.value = false
    tab.value = 'anime'

    await loadAnime(1, false)
    try {
      await loadVideos(1, false)
    } catch {
      videoItems.value = []
      videoHasNext.value = false
      videoLoaded.value = true
    }

    if (animeItems.value.length === 0 && videoItems.value.length > 0) {
      tab.value = 'videos'
    }
  } catch (e: any) {
    error.value = e?.message || 'Pencarian gagal'
  } finally {
    initialLoading.value = false
  }
}

async function switchTab(next: TabKey) {
  if (next === tab.value) return
  tab.value = next
  error.value = null

  const needAnime = next === 'anime' && !animeLoaded.value
  const needVideos = next === 'videos' && !videoLoaded.value
  if (!needAnime && !needVideos) return

  try {
    tabLoading.value = true
    if (needAnime) await loadAnime(1, false)
    if (needVideos) await loadVideos(1, false)
  } catch (e: any) {
    error.value = e?.message || 'Gagal memuat hasil'
  } finally {
    tabLoading.value = false
  }
}

async function loadMore() {
  if (!canLoadMore.value || fetching.value) return
  const nextPage =
    (tab.value === 'anime' ? animePage.value : videoPage.value) + 1
  fetching.value = true
  loadingMore.value = true
  try {
    if (tab.value === 'anime') await loadAnime(nextPage, true)
    else await loadVideos(nextPage, true)
  } catch (e) {
    console.error('Search load more error:', e)
  } finally {
    loadingMore.value = false
    fetching.value = false
  }
}

watch(keyword, () => {
  void bootstrap()
}, { immediate: true })
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">
        {{ keyword ? `Hasil “${keyword}”` : 'Pencarian' }}
      </h1>
    </div>

    <div
      v-if="keyword"
      class="tab-bar"
      role="tablist"
      aria-label="Tipe hasil"
    >
      <FilterChip
        :label="`Anime${initialLoading ? '' : ` · ${animeItems.length}`}`"
        :active="tab === 'anime'"
        @click="switchTab('anime')"
      />
      <FilterChip
        :label="`Video${initialLoading ? '' : ` · ${videoItems.length}`}`"
        :active="tab === 'videos'"
        @click="switchTab('videos')"
      />
    </div>

    <LoadingState v-if="initialLoading || tabLoading" />
    <ErrorState
      v-else-if="error && !items.length"
      :message="error"
      @retry="bootstrap"
    />
    <EmptyState
      v-else-if="!keyword"
      title="Masukkan kata kunci"
      message="Gunakan kolom pencarian di navigasi atas."
    />
    <EmptyState
      v-else-if="!items.length"
      :title="tab === 'anime' ? 'Tidak ada anime' : 'Tidak ada video'"
      message="Coba kata kunci lain atau tab sebelah."
    />
    <template v-else>
      <div class="grid-cards">
        <AnimeCard
          v-for="(item, idx) in items"
          :key="`${tab}-${item.season_id || item.aid || idx}`"
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
