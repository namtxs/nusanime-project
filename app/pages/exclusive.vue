<script setup lang="ts">
import { animeService } from '~/services/animeService'
import type { Anime } from '~/types/anime'

const page = ref(1)
const items = ref<Anime[]>([])
const hasNext = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref<string | null>(null)

const canLoadMore = computed(
  () => hasNext.value && !loading.value && !loadingMore.value
)

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
    const data = await animeService.getPremiumItems(page.value)
    items.value = reset ? data.items : [...items.value, ...data.items]
    hasNext.value = data.hasNext
  } catch (e: any) {
    error.value = e?.message || 'Gagal memuat judul eksklusif'
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

onMounted(() => {
  void load(true)
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Premium</h1>
    </div>
    <p class="page-lead">Koleksi VIP dan judul eksklusif.</p>

    <LoadingState v-if="loading" />
    <ErrorState
      v-else-if="error"
      :message="error"
      @retry="load(true)"
    />
    <EmptyState
      v-else-if="!items.length"
      title="Belum ada judul"
      message="Coba lagi nanti."
    />
    <template v-else>
      <div class="grid-cards premium-grid">
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
.premium-grid {
  gap: 16px 12px;
}

@media (min-width: 640px) {
  .premium-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 900px) {
  .premium-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .premium-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}

.premium-grid :deep(.title) {
  font-size: 0.8125rem;
}
</style>
