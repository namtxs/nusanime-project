<script setup lang="ts">
import { animeService } from '~/services/animeService'

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

const loading = ref(true)
const error = ref<string | null>(null)
const days = ref<
  Array<{ date: string; date_ts: number; day_of_week: number; episodes: any[] }>
>([])
const selectedKey = ref(0)
const nowTs = ref(Math.floor(Date.now() / 1000))

const startOfToday = computed(() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
})

const dayChips = computed(() =>
  days.value.map((day, index) => ({
    key: day.date_ts || index,
    label: DAY_LABELS[day.day_of_week] || '',
    dayNum: String(day.date || dayNumberFromTs(day.date_ts)),
    count: day.episodes?.length || 0,
    isToday:
      day.date_ts >= startOfToday.value - 6 * 3600 &&
      day.date_ts < startOfToday.value + 18 * 3600,
  }))
)

const selected = computed(
  () =>
    days.value.find((d) => d.date_ts === selectedKey.value) || days.value[0]
)

const episodes = computed(() => selected.value?.episodes || [])
const trackRef = ref<HTMLElement | null>(null)

const selectedIndex = computed(() =>
  days.value.findIndex((d) => d.date_ts === selectedKey.value)
)
const canPrev = computed(() => selectedIndex.value > 0)
const canNext = computed(
  () => selectedIndex.value >= 0 && selectedIndex.value < days.value.length - 1
)

function selectDay(key: number) {
  selectedKey.value = key
  centerDay(key)
}

function shiftDay(delta: number) {
  const next = days.value[selectedIndex.value + delta]
  if (!next) return
  selectDay(next.date_ts)
}

function visibleDayCount(track: HTMLElement) {
  return track.clientWidth >= 800 ? 7 : 5
}

function centerDay(key = selectedKey.value, instant = false) {
  nextTick(() => {
    const track = trackRef.value
    if (!track) return
    const chip = track.querySelector<HTMLElement>(`[data-day-key="${key}"]`)
    if (!chip) return
    const chips = [...track.querySelectorAll<HTMLElement>('.day-chip')]
    const index = chips.indexOf(chip)
    if (index < 0) return
    const gap = 8
    const step = chip.offsetWidth + gap
    const visible = visibleDayCount(track)
    const side = Math.floor(visible / 2)
    const first = Math.max(
      0,
      Math.min(index - side, Math.max(0, chips.length - visible))
    )
    track.scrollTo({
      left: first * step,
      behavior: instant ? 'auto' : 'smooth',
    })
  })
}

function dayNumberFromTs(ts: number) {
  if (!ts) return ''
  return String(new Date(ts * 1000).getDate())
}

function isAired(ep: any) {
  if (ep?.published === true || Number(ep?.published) === 1) return true
  const ts = Number(ep?.pub_ts)
  if (ts > 0) return ts <= nowTs.value
  return false
}

async function load() {
  loading.value = true
  error.value = null
  try {
    days.value = await animeService.getSchedule()
    const today = days.value.find(
      (d) =>
        d.date_ts >= startOfToday.value - 6 * 3600 &&
        d.date_ts < startOfToday.value + 18 * 3600
    )
    selectedKey.value = (today || days.value[0])?.date_ts || 0
  } catch (e: any) {
    error.value = e?.message || 'Gagal memuat jadwal'
  } finally {
    loading.value = false
  }
  await nextTick()
  centerDay(selectedKey.value, true)
}

function openEp(ep: any) {
  if (ep?.season_id) openTitle({ season_id: ep.season_id })
}

function cover(ep: any) {
  return proxiedImageUrl(ep.square_cover || ep.cover) || ''
}

function epTitle(ep: any) {
  return asDisplayText(ep.title) || 'Untitled'
}

function epTime(ep: any) {
  return asDisplayText(ep.pub_time) || '—'
}

function epIndex(ep: any) {
  return asDisplayText(ep.pub_index)
}

onMounted(() => {
  void load()
  const tick = setInterval(() => {
    nowTs.value = Math.floor(Date.now() / 1000)
  }, 30000)
  const onResize = () => centerDay(selectedKey.value, true)
  window.addEventListener('resize', onResize)
  onBeforeUnmount(() => {
    clearInterval(tick)
    window.removeEventListener('resize', onResize)
  })
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Schedule</h1>
    </div>

    <LoadingState v-if="loading" />
    <ErrorState
      v-else-if="error"
      :message="error"
      @retry="load"
    />
    <template v-else>
      <div class="day-nav">
        <button
          type="button"
          class="day-arrow"
          :disabled="!canPrev"
          aria-label="Hari sebelumnya"
          @click="shiftDay(-1)"
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
          ref="trackRef"
          class="day-bar"
        >
        <button
          v-for="d in dayChips"
          :key="d.key"
          type="button"
          class="day-chip"
          :data-day-key="d.key"
          :class="{
            active: selectedKey === d.key,
            today: d.isToday && selectedKey !== d.key,
          }"
          @click="selectDay(d.key)"
        >
          <span class="day-name">{{ d.label }}</span>
          <span class="day-num">{{ d.dayNum }}</span>
          <span
            class="day-count"
            :class="{ muted: d.count === 0 }"
          >
            {{ d.count > 0 ? `${d.count} eps` : '—' }}
          </span>
        </button>
        </div>
        <button
          type="button"
          class="day-arrow"
          :disabled="!canNext"
          aria-label="Hari berikutnya"
          @click="shiftDay(1)"
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
      </div>

      <EmptyState
        v-if="!episodes.length"
        title="Tidak ada episode"
        message="Tidak ada jadwal untuk hari ini."
      />
      <div
        v-else
        class="ep-list"
      >
        <button
          v-for="(ep, idx) in episodes"
          :key="`${ep.season_id}-${ep.episode_id}-${idx}`"
          type="button"
          class="row"
          @click="openEp(ep)"
        >
          <div class="poster">
            <img
              v-if="cover(ep)"
              :src="cover(ep)"
              :alt="epTitle(ep)"
              loading="lazy"
            >
          </div>
          <div class="meta">
            <div class="title">
              {{ epTitle(ep) }}
            </div>
            <div class="sub">
              <span class="time">{{ epTime(ep) }}</span>
              <span v-if="epIndex(ep)">{{ epIndex(ep) }}</span>
              <span
                class="badge"
                :class="isAired(ep) ? 'aired' : 'soon'"
              >
                {{ isAired(ep) ? 'Tayang' : 'Belum' }}
              </span>
            </div>
          </div>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.day-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.day-arrow {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--bg-muted);
  color: var(--text);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.day-arrow svg {
  width: 16px;
  height: 16px;
  display: block;
}

.day-arrow:hover:not(:disabled) {
  background: var(--bg-elevated);
  color: var(--accent);
}

.day-arrow:disabled {
  opacity: 0.35;
  cursor: default;
}

.day-bar {
  --day-visible: 5;
  --day-gap: 8px;
  position: relative;
  display: flex;
  gap: var(--day-gap);
  min-width: 0;
  flex: 1;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.day-bar::-webkit-scrollbar {
  display: none;
}

.day-chip {
  flex: 0 0
    calc(
      (100% - (var(--day-visible) - 1) * var(--day-gap)) / var(--day-visible)
    );
  min-width: 0;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-muted);
  color: inherit;
  cursor: pointer;
}

.day-chip:hover:not(.active) {
  border-color: var(--accent-border);
}

.day-chip.today {
  border-color: var(--accent-border);
}

.day-chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}

.day-name {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.day-chip.active .day-name {
  color: var(--on-accent);
}

.day-num {
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1.2;
}

.day-count {
  margin-top: 2px;
  font-size: 0.625rem;
  font-weight: 650;
  color: var(--accent);
}

.day-count.muted {
  color: var(--text-muted);
}

.day-chip.active .day-count {
  color: rgba(255, 255, 255, 0.9);
}

.ep-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 16px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 10px;
  border: 0;
  border-radius: 10px;
  background: var(--bg-elevated);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.row:hover .title {
  color: var(--accent);
}

.poster {
  flex: 0 0 56px;
  width: 56px;
  height: 76px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-muted);
}

.poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.meta {
  min-width: 0;
  flex: 1;
}

.title {
  font-weight: 650;
  font-size: 0.875rem;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 550;
}

.time {
  color: var(--text-secondary);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.badge {
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 750;
  line-height: 1.2;
}

.badge.aired {
  background: var(--bg-muted);
  color: var(--text-secondary);
}

.badge.soon {
  background: var(--accent-soft);
  color: var(--accent);
}

@media (min-width: 800px) {
  .day-bar {
    --day-visible: 7;
  }
}

@media (max-width: 720px) {
  .ep-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .ep-list {
    gap: 8px 8px;
  }

  .row {
    padding: 8px;
    gap: 8px;
  }

  .poster {
    flex-basis: 48px;
    width: 48px;
    height: 66px;
  }

  .title {
    font-size: 0.8125rem;
  }
}
</style>
