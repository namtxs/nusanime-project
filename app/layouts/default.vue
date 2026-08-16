<script setup lang="ts">
import { searchService } from '~/services/searchService'
import type { KeywordSuggestion } from '~/services/searchService'

const route = useRoute()

const navLinks = [
  { to: '/', label: 'Home', exact: true },
  { to: '/explore', label: 'Index' },
  { to: '/schedule', label: 'Jadwal' },
  { to: '/trending', label: 'Trending' },
  { to: '/exclusive', label: 'Premium' },
]

const userLinks = [
  { to: '/history', label: 'History', icon: '⏱' },
  { to: '/favorites', label: 'My List', icon: '♡' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

const searchQuery = ref('')
const suggestions = ref<KeywordSuggestion[]>([])
const suggestOpen = ref(false)
const suggestLoading = ref(false)
const searchFocused = ref(false)
let suggestTimer: ReturnType<typeof setTimeout> | null = null
let suggestSeq = 0

const overlayNav = computed(() => route.path === '/')
const navScrolled = ref(false)

function onWinScroll() {
  navScrolled.value = window.scrollY > 40
}

watch(overlayNav, (on) => {
  if (!import.meta.client) return
  if (on) {
    navScrolled.value = window.scrollY > 40
    window.addEventListener('scroll', onWinScroll, { passive: true })
  } else {
    window.removeEventListener('scroll', onWinScroll)
    navScrolled.value = false
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener('scroll', onWinScroll)
})

const isSearchPage = computed(
  () => route.path === '/search' || route.path.startsWith('/search-result')
)

const isActive = (to: string, exact = false) => {
  if (exact) return route.path === to
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

const showSuggestPanel = computed(
  () =>
    searchFocused.value &&
    searchQuery.value.trim().length > 0 &&
    (suggestLoading.value || suggestions.value.length > 0 || suggestOpen.value)
)

watch(
  () => route.query.q,
  (value) => {
    if (isSearchPage.value && typeof value === 'string') {
      searchQuery.value = value
    }
  },
  { immediate: true }
)

watch(searchQuery, (value) => {
  if (suggestTimer) clearTimeout(suggestTimer)
  const keyword = value.trim()
  if (!keyword) {
    suggestions.value = []
    suggestOpen.value = false
    suggestLoading.value = false
    return
  }
  suggestTimer = setTimeout(async () => {
    const seq = ++suggestSeq
    suggestLoading.value = true
    try {
      const data = await searchService.getSuggestions(keyword)
      if (seq !== suggestSeq) return
      suggestions.value = data.slice(0, 8)
      suggestOpen.value = true
    } catch {
      if (seq !== suggestSeq) return
      suggestions.value = []
      suggestOpen.value = true
    } finally {
      if (seq === suggestSeq) suggestLoading.value = false
    }
  }, 280)
})

function submitSearch(keyword?: string) {
  const q = (keyword ?? searchQuery.value).trim()
  suggestOpen.value = false
  searchFocused.value = false
  if (!q) {
    void navigateTo('/search')
    return
  }
  searchQuery.value = q
  void navigateTo(`/search-result?q=${encodeURIComponent(q)}`)
}

function onSearchFocus() {
  searchFocused.value = true
  if (suggestions.value.length) suggestOpen.value = true
}

function onSearchBlur() {
  setTimeout(() => {
    searchFocused.value = false
    suggestOpen.value = false
  }, 160)
}

onBeforeUnmount(() => {
  if (suggestTimer) clearTimeout(suggestTimer)
})
</script>

<template>
  <div class="shell">
    <AmbientBackdrop />
    <header
      class="site-header"
      :class="{ overlay: overlayNav, solid: overlayNav && navScrolled }"
    >
      <div class="header-inner">
        <NuxtLink
          to="/"
          class="brand"
        >
          <span class="brand-mark">N</span>
          <span class="brand-copy">
            <span class="brand-name">NUSANIME</span>
            <span class="brand-tag">Anime</span>
          </span>
        </NuxtLink>

        <nav
          class="main-nav"
          aria-label="Navigasi utama"
        >
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="main-link"
            :class="{ active: isActive(link.to, link.exact) }"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <form
          class="search-wrap"
          @submit.prevent="submitSearch()"
        >
          <div
            class="search-box"
            :class="{ focused: searchFocused }"
          >
            <span
              class="search-icon"
              aria-hidden="true"
            >⌕</span>
            <input
              v-model="searchQuery"
              class="search-input"
              type="search"
              name="q"
              placeholder="Cari anime, video, genre…"
              autocomplete="off"
              aria-label="Cari"
              @focus="onSearchFocus"
              @blur="onSearchBlur"
            >
            <button
              v-if="searchQuery"
              type="button"
              class="search-clear"
              aria-label="Hapus"
              @mousedown.prevent="searchQuery = ''; suggestions = []"
            >
              ×
            </button>
          </div>

          <div
            v-if="showSuggestPanel"
            class="suggest-panel"
          >
            <p
              v-if="suggestLoading"
              class="suggest-hint"
            >
              Mencari saran…
            </p>
            <p
              v-else-if="!suggestions.length"
              class="suggest-hint"
            >
              Tekan Enter untuk cari
            </p>
            <ul
              v-else
              class="suggest-list"
            >
              <li
                v-for="(s, idx) in suggestions"
                :key="`${s.keyword}-${idx}`"
              >
                <button
                  type="button"
                  @mousedown.prevent="submitSearch(s.keyword)"
                >
                  <span class="suggest-glyph">⌕</span>
                  <span>
                    <template v-if="s.match?.length">
                      <span
                        v-for="(part, i) in s.match"
                        :key="i"
                        :class="part.match ? 'hl' : 'nm'"
                      >{{ part.str }}</span>
                    </template>
                    <template v-else>
                      {{ s.keyword }}
                    </template>
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </form>

        <div class="user-nav">
          <NuxtLink
            v-for="link in userLinks"
            :key="link.to"
            :to="link.to"
            class="user-link"
            :class="{ active: isActive(link.to) }"
            :title="link.label"
          >
            <span class="user-icon">{{ link.icon }}</span>
            <span class="user-label">{{ link.label }}</span>
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="main">
      <slot />
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.shell {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.site-header.overlay {
  position: fixed;
  left: 0;
  right: 0;
  background: linear-gradient(
    180deg,
    rgba(var(--bg-rgb), 0.92) 0%,
    rgba(var(--bg-rgb), 0.45) 62%,
    transparent 100%
  );
  border-bottom: 0;
}

.site-header.overlay.solid {
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.header-inner {
  width: 100%;
  min-height: var(--nav-h);
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas:
    'brand search user'
    'nav nav nav';
  align-items: center;
  gap: 10px 16px;
  padding: 10px clamp(16px, 3vw, 28px) 12px;
}

.brand {
  grid-area: brand;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.brand-mark {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: var(--accent);
  color: #fff;
  font-weight: 800;
  display: grid;
  place-items: center;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.brand-name {
  font-weight: 800;
  font-size: 0.9375rem;
  letter-spacing: 0.04em;
  line-height: 1.1;
}

.brand-tag {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.main-nav {
  grid-area: nav;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.main-nav::-webkit-scrollbar {
  display: none;
}

.main-link {
  position: relative;
  padding: 8px 12px;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  transition:
    color 0.12s ease,
    background 0.12s ease;
}

.main-link:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.08);
}

.main-link.active {
  color: var(--text);
  background: transparent;
  box-shadow: inset 0 -2px 0 var(--accent);
}

.search-wrap {
  grid-area: search;
  position: relative;
  width: 100%;
  max-width: 420px;
  justify-self: center;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  height: 40px;
  border-radius: 6px;
  border: 2px solid transparent;
  background: #2f2f35;
  transition: border-color 0.12s ease;
}

.search-box.focused {
  border-color: var(--accent);
  box-shadow: none;
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 0.875rem;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-clear {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
}

.suggest-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 60;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.suggest-hint {
  margin: 0;
  padding: 14px 16px;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.suggest-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 320px;
  overflow-y: auto;
}

.suggest-list button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: 0;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  font-size: 0.875rem;
}

.suggest-list button:hover {
  background: var(--bg-muted);
}

.suggest-glyph {
  color: var(--text-muted);
}

.nm {
  color: var(--text-secondary);
}

.hl {
  color: var(--accent);
  font-weight: 700;
}

.user-nav {
  grid-area: user;
  display: flex;
  gap: 4px;
  justify-self: end;
}

.user-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 650;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.user-link:hover,
.user-link.active {
  color: var(--text);
  background: rgba(255, 255, 255, 0.08);
}

.user-icon {
  font-size: 0.9rem;
  line-height: 1;
}

.main {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
}

@media (min-width: 960px) {
  .header-inner {
    grid-template-columns: auto 1fr minmax(280px, 480px) auto;
    grid-template-areas: 'brand nav search user';
    gap: 24px;
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .main-nav {
    justify-content: flex-start;
    overflow: visible;
    gap: 6px;
  }
}

@media (max-width: 959px) {
  .brand-tag,
  .user-label {
    display: none;
  }

  .search-wrap {
    max-width: none;
  }
}

@media (max-width: 640px) {
  .header-inner {
    gap: 8px;
    padding-top: 8px;
    padding-bottom: 10px;
  }

  .user-link {
    padding: 8px;
  }
}
</style>
