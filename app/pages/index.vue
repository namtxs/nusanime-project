<script setup lang="ts">
import { featuredService } from '~/services/featuredService'
import { animeService } from '~/services/animeService'
import type { FeaturedItem, Module, Anime } from '~/types/anime'

const CONTENT_STYLES = new Set([
  'top_n',
  'trending_now',
  'new_v_card_v1',
  'foryou_v1',
])

const MIN_RAIL_ITEMS = 8
const MAX_RAIL_ITEMS = 16
const MIN_TOTAL_SECTIONS = 10

/** Genre rails — keys must exist in backend GENRE_STYLE_MAP */
const GENRE_RAILS = [
  { key: 'isekai', label: 'Isekai' },
  { key: 'aksi', label: 'Aksi' },
  { key: 'fantasi', label: 'Fantasi' },
  { key: 'romantis', label: 'Romantis' },
  { key: 'komedi', label: 'Komedi' },
  { key: 'petualangan', label: 'Petualangan' },
  { key: 'berjuang', label: 'Berjuang' },
  { key: 'supranatural', label: 'Supranatural' },
  { key: 'misteri', label: 'Misteri' },
  { key: 'sekolah', label: 'Sekolah' },
  { key: 'fiksi_ilmiah', label: 'Fiksi Ilmiah' },
  { key: 'harem', label: 'Harem' },
] as const

const loading = ref(true)
const error = ref<string | null>(null)
const banner = ref<FeaturedItem[]>([])
const modules = ref<Array<Module & { animeItems: Anime[] }>>([])

function itemKey(item: Anime): string {
  return String(item.season_id || item.aid || item.title || '')
}

function dedupe(items: Anime[]): Anime[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = itemKey(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function toAnimeList(items: unknown[]): Anime[] {
  return items.map(mapCardToAnime).filter(Boolean) as Anime[]
}

function prepareModules(list: Module[]) {
  const raw: Array<Module & { animeItems: Anime[] }> = []
  const forYouItems: Anime[] = []

  for (const mod of list) {
    if (!CONTENT_STYLES.has(mod.style)) continue
    if (!Array.isArray(mod.items) || !mod.items.length) continue

    const animeItems = toAnimeList(mod.items)
    if (!animeItems.length) continue

    if (mod.style === 'foryou_v1') {
      forYouItems.push(...animeItems)
      continue
    }

    const title = String(mod.header?.title || '').trim()
    raw.push({
      ...mod,
      header: {
        title:
          title ||
          (mod.style === 'trending_now'
            ? 'Sedang Tren'
            : mod.style === 'new_v_card_v1'
              ? 'Baru Dirilis'
              : mod.style === 'top_n'
                ? 'Top Charts'
                : 'Rekomendasi'),
        uri: mod.header?.uri,
      },
      animeItems,
    })
  }

  if (forYouItems.length) {
    const merged = dedupe(forYouItems)
    if (merged.length) {
      raw.push({
        module_id: 'foryou-merged',
        style: 'foryou_v1',
        header: { title: 'Rekomendasi', uri: '/explore' },
        items: merged,
        animeItems: merged,
      })
    }
  }

  return raw
}

async function fetchGenreItems(genreKey: string): Promise<Anime[]> {
  try {
    const data = await animeService.getGenreItems(genreKey, 1)
    return data.items.slice(0, MAX_RAIL_ITEMS)
  } catch {
    return []
  }
}

async function fetchGenrePool(): Promise<Map<string, Anime[]>> {
  const results = await Promise.allSettled(
    GENRE_RAILS.map(async (g) => {
      const items = await fetchGenreItems(g.key)
      return [g.key, items] as const
    })
  )
  const pool = new Map<string, Anime[]>()
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const [key, items] = result.value
    if (items.length) pool.set(key, [...items])
  }
  return pool
}

function takeFromPool(
  pool: Map<string, Anime[]>,
  needed: number,
  used: Set<string>
): Anime[] {
  if (needed <= 0) return []
  const taken: Anime[] = []
  let progress = true
  while (taken.length < needed && progress) {
    progress = false
    for (const [, list] of pool) {
      while (list.length && taken.length < needed) {
        const next = list.shift()!
        const key = itemKey(next)
        if (!key || used.has(key)) continue
        used.add(key)
        taken.push(next)
        progress = true
        break
      }
    }
  }
  return taken
}

async function buildGenreRail(
  genre: (typeof GENRE_RAILS)[number],
  used: Set<string>
): Promise<(Module & { animeItems: Anime[] }) | null> {
  const items = await fetchGenreItems(genre.key)
  const fresh = items.filter((item) => {
    const key = itemKey(item)
    if (!key || used.has(key)) return false
    used.add(key)
    return true
  })
  if (fresh.length < MIN_RAIL_ITEMS) return null

  return {
    module_id: `genre-${genre.key}`,
    style: 'index_fill',
    header: {
      title: genre.label,
      uri: `/explore?genre=${genre.key}`,
    },
    items: fresh.slice(0, MAX_RAIL_ITEMS),
    animeItems: fresh.slice(0, MAX_RAIL_ITEMS),
  }
}

async function enrichModules(
  base: Array<Module & { animeItems: Anime[] }>
): Promise<Array<Module & { animeItems: Anime[] }>> {
  const pool = await fetchGenrePool()
  const used = new Set<string>()

  for (const mod of base) {
    for (const item of mod.animeItems) {
      const key = itemKey(item)
      if (key) used.add(key)
    }
  }

  const topped = base.map((mod) => {
    let items = [...mod.animeItems]
    if (items.length < MIN_RAIL_ITEMS && pool.size) {
      const fill = takeFromPool(pool, MIN_RAIL_ITEMS - items.length, used)
      items = dedupe([...items, ...fill])
    }
    return {
      ...mod,
      animeItems: items.slice(0, MAX_RAIL_ITEMS),
    }
  })

  const extras: Array<Module & { animeItems: Anime[] }> = []
  for (const genre of GENRE_RAILS) {
    if (topped.length + extras.length >= MIN_TOTAL_SECTIONS + 2) break
    const rail = await buildGenreRail(genre, used)
    if (rail) extras.push(rail)
  }

  return [...topped, ...extras]
}

async function loadHome() {
  loading.value = true
  error.value = null
  try {
    const data = await featuredService.getFeaturedList()
    const list = data.modules || []
    if (!list.length) throw new Error('Konten beranda kosong')

    const bannerModule = list.find((m) => m.style === 'banner')
    banner.value = Array.isArray(bannerModule?.items)
      ? (bannerModule!.items.filter(Boolean) as FeaturedItem[])
      : []

    const base = prepareModules(list)
    modules.value = await enrichModules(base)

    if (!modules.value.length && !banner.value.length) {
      throw new Error('Tidak ada modul yang bisa ditampilkan')
    }
  } catch (e: any) {
    error.value = e?.message || 'Gagal memuat beranda'
  } finally {
    loading.value = false
  }
}

function viewAll(mod: Module) {
  const uri = String(mod.header?.uri || '')
  if (uri.startsWith('/explore?genre=')) return navigateTo(uri)
  const lower = uri.toLowerCase()
  if (lower.includes('rank') || lower.includes('trending') || lower.includes('top')) {
    return navigateTo('/trending')
  }
  if (lower.includes('schedule') || lower.includes('jadwal')) {
    return navigateTo('/schedule')
  }
  if (lower.includes('premium') || lower.includes('vip')) {
    return navigateTo('/exclusive')
  }
  return navigateTo('/explore')
}

onMounted(() => {
  void loadHome()
})
</script>

<template>
  <div class="home">
    <LoadingState
      v-if="loading"
      class="home-loading"
    />

    <ErrorState
      v-else-if="error"
      :message="error"
      @retry="loadHome"
    />

    <template v-else>
      <HeroBanner
        v-if="banner.length"
        :items="banner"
      />

      <div class="home-content">
        <section
          v-for="(mod, modIndex) in modules"
          :key="`${mod.module_id || mod.style}-${modIndex}`"
          class="section"
        >
          <div class="section-head">
            <h2 class="section-title">
              {{ mod.header?.title || 'Rekomendasi' }}
            </h2>
            <button
              type="button"
              class="see-all"
              @click="viewAll(mod)"
            >
              Lihat semua
            </button>
          </div>
          <div class="rail hide-scrollbar">
            <AnimeCard
              v-for="(item, idx) in mod.animeItems"
              :key="`${item.season_id || item.aid || idx}`"
              :anime="item"
              compact
              :rank="mod.style === 'top_n' || mod.style === 'trending_now' ? idx + 1 : undefined"
            />
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.home {
  padding-bottom: 8px;
}

.home-loading {
  min-height: 100svh;
  padding: 160px var(--gutter) 80px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.home-content {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 20px var(--gutter) 0;
}

.section {
  margin-bottom: 32px;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
}

.see-all {
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 650;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
  white-space: nowrap;
}

.rail {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 6px;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}
</style>
