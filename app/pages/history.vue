<script setup lang="ts">
import type { WatchHistoryItem } from '~/types/anime'

const store = useAppStore()
store.hydrate()

const items = computed(() => store.watchHistory.value)

function cover(item: WatchHistoryItem) {
  return proxiedImageUrl(pickHistoryImage(item.thumbnail, item.cover), 'landscape') || ''
}

function resume(item: WatchHistoryItem) {
  openHistoryPlay(item)
}

function remove(item: WatchHistoryItem) {
  if (confirm(`Hapus “${displayHistoryTitle(item)}” dari history?`)) {
    store.removeFromHistory(item.episode_id)
  }
}

function clearAll() {
  if (confirm('Hapus semua history?')) {
    store.clearHistory()
  }
}

function progressLabel(item: WatchHistoryItem) {
  if (item.duration > 0) {
    return `${formatWatchTime(item.progress)} / ${formatWatchTime(item.duration)}`
  }
  return 'Lanjutkan'
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">History</h1>
      <button
        v-if="items.length"
        class="clear-btn"
        type="button"
        @click="clearAll"
      >
        Clear
      </button>
    </div>

    <EmptyState
      v-if="!items.length"
      title="Belum ada history"
      message="Episode yang ditonton akan muncul di sini."
    />
    <div
      v-else
      class="history-list"
    >
      <article
        v-for="item in items"
        :key="historyGroupKey(item) || item.episode_id"
        class="history-row"
      >
        <button
          type="button"
          class="history-main"
          @click="resume(item)"
        >
          <div class="thumb">
            <img
              v-if="cover(item)"
              :src="cover(item)"
              :alt="displayHistoryTitle(item)"
              loading="lazy"
            >
            <div
              v-if="progressPercent(item) > 0"
              class="bar"
            >
              <span :style="{ width: `${progressPercent(item)}%` }" />
            </div>
          </div>
          <div class="meta">
            <h2 class="title">
              {{ displayHistoryTitle(item) }}
            </h2>
            <p
              v-if="displayHistoryEpisode(item)"
              class="ep"
            >
              {{ displayHistoryEpisode(item) }}
            </p>
            <div class="meta-row">
              <span>{{ progressLabel(item) }}</span>
              <span>{{ formatRelativeWatchDate(item.watched_at) }}</span>
            </div>
          </div>
        </button>
        <button
          class="remove"
          type="button"
          aria-label="Hapus"
          @click="remove(item)"
        >
          Hapus
        </button>
      </article>
    </div>
  </div>
</template>

<style scoped>
.clear-btn {
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 0.875rem;
  font-weight: 650;
  cursor: pointer;
}

.history-list {
  display: flex;
  flex-direction: column;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.history-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.thumb {
  position: relative;
  flex: 0 0 128px;
  width: 128px;
  height: 72px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-muted);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.2);
}

.bar span {
  display: block;
  height: 100%;
  background: var(--accent);
}

.meta {
  min-width: 0;
  flex: 1;
}

.title {
  margin: 0 0 4px;
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ep {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 500;
}

.remove {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.remove:hover {
  color: var(--accent);
}

@media (max-width: 640px) {
  .thumb {
    flex-basis: 112px;
    width: 112px;
    height: 63px;
  }
}
</style>
