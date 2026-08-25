<script setup lang="ts">
import type { Anime } from '~/types/anime'

const props = defineProps<{
  anime: Anime
  rank?: number
  /** Fixed width for horizontal rails */
  compact?: boolean
}>()

const cover = computed(() => getCoverImageUrl(props.anime))
const title = computed(() => String(props.anime?.title || 'Untitled'))
const badge = computed(() => displayBadge(props.anime?.badge))
const status = computed(() => {
  const s = props.anime?.subtitle
  return typeof s === 'string' && s.trim() ? s.trim() : ''
})

function onOpen() {
  openTitle(props.anime)
}

function onImgError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}
</script>

<template>
  <button
    type="button"
    class="card"
    :class="{ compact }"
    @click="onOpen"
  >
    <div class="poster">
      <img
        v-if="cover"
        :src="cover"
        :alt="title"
        loading="lazy"
        decoding="async"
        @error="onImgError"
      >
      <div
        v-else
        class="poster-fallback"
      />
      <span
        v-if="rank"
        class="rank"
      >{{ rank }}</span>
      <span
        v-if="badge"
        class="badge"
      >{{ badge }}</span>
      <span
        v-if="status"
        class="status"
      >{{ status }}</span>
    </div>
    <div class="title">
      {{ title }}
    </div>
  </button>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.card.compact {
  width: 132px;
  flex: 0 0 132px;
  max-width: 132px;
}

@media (min-width: 768px) {
  .card.compact {
    width: 148px;
    flex-basis: 148px;
    max-width: 148px;
  }
}

.card:hover .poster img {
  transform: scale(1.04);
}

.poster {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4.2;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-muted);
  flex: 0 0 auto;
}

.poster::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 42%;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.82));
  pointer-events: none;
  z-index: 1;
}

.poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s ease;
}

.poster-fallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(160deg, var(--bg-muted), var(--bg));
}

.rank {
  position: absolute;
  left: 6px;
  top: 6px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.82);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  display: grid;
  place-items: center;
  z-index: 2;
}

.badge {
  position: absolute;
  left: 6px;
  top: 6px;
  padding: 3px 7px;
  border-radius: 4px;
  background: var(--accent);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 800;
  line-height: 1.2;
  z-index: 2;
  max-width: calc(100% - 12px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank + .badge {
  left: auto;
  right: 6px;
}

.status {
  position: absolute;
  left: 6px;
  bottom: 6px;
  max-width: calc(100% - 12px);
  padding: 4px 7px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.88);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 2;
}

.title {
  color: #efeff1;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
</style>
