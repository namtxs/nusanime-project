<script setup lang="ts">
import type { FeaturedItem } from '~/types/anime'

const props = defineProps<{
  items: FeaturedItem[]
}>()

const store = useAppStore()
store.hydrate()
const ambient = useAmbientBg()

const index = ref(0)
const progress = ref(0)
const paused = ref(false)
const motionReady = ref(false)

const SLIDE_MS = 6000
const TICK_MS = 50

const hasMany = computed(() => props.items.length > 1)

const trackStyle = computed(() => ({
  transform: `translate3d(-${index.value * 100}%, 0, 0)`,
}))

let timer: ReturnType<typeof setInterval> | null = null
let touchStartX = 0
let touchStartY = 0

function itemId(item: FeaturedItem, i: number) {
  return String(item.item_id ?? item.season_id ?? item.aid ?? i)
}

function coverOf(item: FeaturedItem) {
  return getBackdropImageUrl(item.cover)
}

function isInList(item: FeaturedItem) {
  const id = String(item.season_id || item.aid || '')
  return id ? store.isFavorite(id) : false
}

watch(
  () => props.items.length,
  (len) => {
    if (index.value >= len) {
      index.value = 0
      progress.value = 0
    }
  }
)

watch(
  () => coverOf(props.items[index.value] || props.items[0]),
  (url) => ambient.setAmbient(url),
  { immediate: true }
)

function goTo(i: number) {
  if (!props.items.length) return
  index.value =
    ((i % props.items.length) + props.items.length) % props.items.length
  progress.value = 0
}

function next() {
  goTo(index.value + 1)
}

function prev() {
  goTo(index.value - 1)
}

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  touchStartX = touch.clientX
  touchStartY = touch.clientY
}

function onTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0]
  if (!touch) return
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return
  if (dx < 0) next()
  else prev()
}

function resetTimer() {
  if (timer) clearInterval(timer)
  progress.value = 0
  if (!hasMany.value || paused.value) return

  timer = setInterval(() => {
    progress.value += (TICK_MS / SLIDE_MS) * 100
    if (progress.value >= 100) next()
  }, TICK_MS)
}

watch([index, () => props.items.length, paused], resetTimer)

onMounted(() => {
  resetTimer()
  requestAnimationFrame(() => {
    motionReady.value = true
  })
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  ambient.clearAmbient()
})

function open(item: FeaturedItem) {
  openTitle(item)
}

function toggleList(item: FeaturedItem) {
  const id = String(item.season_id || item.aid || '')
  if (!id) return
  if (store.isFavorite(id)) store.removeFromFavorites(id)
  else {
    store.addToFavorites({
      season_id: id,
      title: item.title,
      cover: item.cover,
    })
  }
}
</script>

<template>
  <section
    v-if="props.items.length"
    class="hero"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
  >
    <div class="hero-shell">
      <div
        class="hero-viewport"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <div
          class="hero-track"
          :class="{ 'is-ready': motionReady }"
          :style="trackStyle"
        >
          <article
            v-for="(item, i) in props.items"
            :key="itemId(item, i)"
            class="hero-slide"
            :class="{ 'is-active': i === index }"
          >
            <div
              v-if="coverOf(item)"
              class="hero-blur"
              aria-hidden="true"
            >
              <img
                class="hero-blur-img"
                :src="coverOf(item)"
                alt=""
                loading="lazy"
              >
            </div>

            <img
              v-if="coverOf(item)"
              class="hero-img"
              :src="coverOf(item)"
              :alt="item.title"
              loading="eager"
              :fetchpriority="i === 0 ? 'high' : 'low'"
            >
            <div
              v-else
              class="hero-fallback"
            />

            <div class="hero-scrim" />
            <div class="hero-fade" />

            <div class="hero-body">
              <div class="hero-inner">
                <h2 class="hero-title">{{ item.title }}</h2>
                <p
                  v-if="item.subtitle"
                  class="hero-sub"
                >
                  {{ item.subtitle }}
                </p>

                <div class="hero-actions">
                  <button
                    class="btn btn-primary"
                    type="button"
                    @click="open(item)"
                  >
                    ▶ Putar
                  </button>
                  <button
                    class="btn hero-list-btn"
                    type="button"
                    @click="toggleList(item)"
                  >
                    {{ isInList(item) ? '✓ Daftar Saya' : '+ Daftar Saya' }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>

      <button
        v-if="hasMany"
        type="button"
        class="nav-arrow prev"
        aria-label="Slide sebelumnya"
        @click="prev"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
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
      <button
        v-if="hasMany"
        type="button"
        class="nav-arrow next"
        aria-label="Slide berikutnya"
        @click="next"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
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

      <div
        v-if="hasMany"
        class="hero-footer"
      >
        <div class="hero-inner footer-inner">
        <div
          class="dots"
          role="tablist"
          aria-label="Pilih slide"
        >
          <button
            v-for="(_, i) in props.items"
            :key="i"
            type="button"
            class="dot"
            :class="{ active: i === index }"
            :aria-label="`Slide ${i + 1}`"
            :aria-selected="i === index"
            role="tab"
            @click="goTo(i)"
          >
            <span
              v-if="i === index"
              class="dot-fill"
              :style="{ width: `${progress}%` }"
            />
          </button>
        </div>
        <span class="slide-count">{{ index + 1 }} / {{ props.items.length }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  width: 100%;
  padding: 0;
  background: transparent;
}

.hero-shell {
  position: relative;
  width: 100%;
  margin: 0;
  border-radius: 0;
  overflow: hidden;
  border: 0;
  background: var(--bg);
}

.hero-viewport {
  overflow: hidden;
}

.hero-track {
  display: flex;
  will-change: transform;
}

.hero-track.is-ready {
  transition: transform 0.72s cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-slide {
  position: relative;
  flex: 0 0 100%;
  height: clamp(380px, 56vw, 620px);
  overflow: hidden;
  background: var(--bg);
}

@media (min-width: 900px) {
  .hero-slide {
    height: clamp(480px, 48vw, 680px);
  }
}

.hero-img,
.hero-fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
}

.hero-img {
  object-fit: cover;
  object-position: center 18%;
  -webkit-mask-image: linear-gradient(
    to bottom,
    #000 0%,
    #000 68%,
    rgba(0, 0, 0, 0.55) 84%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    #000 0%,
    #000 68%,
    rgba(0, 0, 0, 0.55) 84%,
    transparent 100%
  );
}

.hero-blur {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  pointer-events: none;
}

.hero-blur-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 18%;
  filter: blur(20px) saturate(1.05);
  transform: scale(1.04);
  transform-origin: center center;
}

.hero-fallback {
  background: linear-gradient(160deg, var(--bg-muted) 0%, var(--bg) 100%);
}

.hero-scrim {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(var(--bg-rgb), 0.55) 0%,
    rgba(var(--bg-rgb), 0.12) 22%,
    transparent 40%,
    transparent 58%,
    rgba(var(--bg-rgb), 0.08) 100%
  );
}

.hero-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 48%;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(var(--bg-rgb), 0.2) 35%,
    rgba(var(--bg-rgb), 0.65) 62%,
    rgba(var(--bg-rgb), 0.92) 84%,
    var(--bg) 100%
  );
}

.hero-body {
  position: absolute;
  inset: auto 0 0;
  z-index: 4;
  padding: 0 0 48px;
}

.hero-inner {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 var(--gutter);
}

.hero-title {
  margin: 0 0 6px;
  font-size: clamp(1.125rem, 2.6vw, 1.625rem);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hero-sub {
  margin: 0 0 14px;
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 600;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hero-list-btn {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: background 0.2s ease;
}

.hero-list-btn:hover {
  background: rgba(255, 255, 255, 0.16);
}

.nav-arrow {
  position: absolute;
  top: 50%;
  z-index: 6;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(var(--bg-rgb), 0.58);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  opacity: 0;
  transform: translateY(-50%);
  transition:
    opacity 0.2s ease,
    background 0.15s ease;
}

.nav-arrow svg {
  width: 18px;
  height: 18px;
  display: block;
}

.hero:hover .nav-arrow {
  opacity: 1;
}

.nav-arrow:hover {
  background: rgba(var(--bg-rgb), 0.82);
}

.nav-arrow.prev {
  left: 14px;
}

.nav-arrow.next {
  right: 14px;
}

.hero-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0 14px;
  pointer-events: none;
}

.hero-footer > * {
  pointer-events: auto;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dots {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  position: relative;
  width: 6px;
  height: 6px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.28);
  cursor: pointer;
  overflow: hidden;
  transition:
    width 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    background 0.25s ease;
}

.dot.active {
  width: 22px;
  background: rgba(255, 255, 255, 0.16);
}

.dot-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--accent);
  border-radius: inherit;
  transition: width 0.08s linear;
}

.slide-count {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 650;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  transition: opacity 0.25s ease;
}

@media (max-width: 640px) {
  .nav-arrow {
    display: none;
  }

  .hero-body {
    padding-bottom: 40px;
  }

  .hero-slide {
    height: clamp(320px, 72vw, 440px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-track.is-ready {
    transition: none;
  }
}
</style>
