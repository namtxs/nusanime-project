<script setup lang="ts">
import { animeService } from '~/services/animeService'
import { TRENDING_TYPES } from '~/utils/genres'
import type { Anime } from '~/types/anime'

const type = ref('umum')
const items = ref<Anime[]>([])
const title = ref('Trending')
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await animeService.getTrending(type.value)
    title.value = data.title || 'Trending'
    items.value = data.items
  } catch (e: any) {
    error.value = e?.message || 'Gagal memuat trending'
  } finally {
    loading.value = false
  }
}

function selectType(key: string) {
  if (key === type.value) return
  type.value = key
  void load()
}

function cover(item: Anime) {
  return getCoverImageUrl(item)
}

function synopsis(item: Anime) {
  return asDisplayText(item.desc)
}

function stylesOf(item: Anime) {
  return Array.isArray(item.styles)
    ? item.styles.filter((s): s is string => typeof s === 'string' && !!s).slice(0, 3)
    : []
}

function rankOf(item: Anime, index: number) {
  const n = Number(item.rank_order)
  return Number.isFinite(n) && n > 0 ? n : index + 1
}

function open(item: Anime) {
  openTitle(item)
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">{{ title }}</h1>
    </div>

    <div class="chips">
      <FilterChip
        v-for="t in TRENDING_TYPES"
        :key="t.key"
        :label="t.label"
        :active="type === t.key"
        @click="selectType(t.key)"
      />
    </div>

    <LoadingState v-if="loading" />
    <ErrorState
      v-else-if="error"
      :message="error"
      @retry="load"
    />
    <EmptyState
      v-else-if="!items.length"
      title="Tidak ada data"
    />
    <div
      v-else
      class="rank-list"
    >
      <button
        v-for="(item, idx) in items"
        :key="`${item.season_id || item.aid || idx}`"
        type="button"
        class="row"
        @click="open(item)"
      >
        <div class="poster">
          <img
            v-if="cover(item)"
            :src="cover(item)"
            :alt="item.title"
            loading="lazy"
          >
          <span class="rank">{{ rankOf(item, idx) }}</span>
        </div>
        <div class="meta">
          <h2 class="title">
            {{ item.title }}
          </h2>
          <p
            v-if="stylesOf(item).length"
            class="styles"
          >
            {{ stylesOf(item).join(' · ') }}
          </p>
          <p
            v-if="synopsis(item)"
            class="desc"
          >
            {{ synopsis(item) }}
          </p>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.rank-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 28px;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.poster {
  position: relative;
  flex: 0 0 128px;
  width: 128px;
  aspect-ratio: 3 / 4;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-muted);
}

.poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.poster::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 42%;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.78), transparent);
  pointer-events: none;
}

.meta {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 0;
}

.rank {
  position: absolute;
  left: 6px;
  bottom: 6px;
  z-index: 1;
  min-width: 26px;
  padding: 3px 7px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  text-align: center;
}

.title {
  margin: 0;
  font-size: 1rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.row:hover .title {
  color: var(--accent);
}

.styles {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.desc {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 900px) {
  .rank-list {
    gap: 16px 16px;
  }

  .poster {
    flex-basis: 104px;
    width: 104px;
  }
}

@media (max-width: 640px) {
  .rank-list {
    gap: 14px 10px;
  }

  .row {
    gap: 8px;
  }

  .rank {
    font-size: 1.0625rem;
    left: 6px;
    bottom: 4px;
  }

  .poster {
    flex-basis: 84px;
    width: 84px;
  }

  .title {
    font-size: 0.875rem;
  }

  .desc {
    font-size: 0.75rem;
    -webkit-line-clamp: 2;
  }
}
</style>
