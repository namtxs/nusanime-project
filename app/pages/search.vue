<script setup lang="ts">
import { searchService } from '~/services/searchService'
import type { KeywordSuggestion } from '~/services/searchService'

const q = ref('')
const suggestions = ref<KeywordSuggestion[]>([])
const loading = ref(false)
const showSuggestions = ref(false)
const focused = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let seq = 0

watch(q, (value) => {
  if (timer) clearTimeout(timer)
  const keyword = value.trim()
  if (!keyword) {
    suggestions.value = []
    showSuggestions.value = false
    loading.value = false
    return
  }
  timer = setTimeout(async () => {
    const current = ++seq
    loading.value = true
    try {
      const data = await searchService.getSuggestions(keyword)
      if (current !== seq) return
      suggestions.value = data.slice(0, 12)
      showSuggestions.value = true
    } catch {
      if (current !== seq) return
      suggestions.value = []
      showSuggestions.value = true
    } finally {
      if (current === seq) loading.value = false
    }
  }, 280)
})

function goSearch(keyword?: string) {
  const term = (keyword ?? q.value).trim()
  if (!term) return
  showSuggestions.value = false
  void navigateTo(`/search-result?q=${encodeURIComponent(term)}`)
}

function clearQuery() {
  q.value = ''
  suggestions.value = []
  showSuggestions.value = false
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">
        Cari
      </h1>
    </div>
    <p class="page-lead">
      Cari judul anime atau video unggahan pengguna.
    </p>

    <form
      class="search-form"
      @submit.prevent="goSearch()"
    >
      <div
        class="search-bar"
        :class="{ focused }"
      >
        <span class="glyph">⌕</span>
        <input
          v-model="q"
          class="search-input"
          type="search"
          placeholder="Ketik judul atau kata kunci…"
          autofocus
          autocomplete="off"
          @focus="focused = true"
          @blur="focused = false"
        >
        <button
          v-if="q"
          class="clear-btn"
          type="button"
          aria-label="Clear"
          @click="clearQuery"
        >
          ×
        </button>
      </div>
      <button
        class="btn btn-primary"
        type="submit"
      >
        Cari
      </button>
    </form>

    <p
      v-if="loading"
      class="hint"
    >
      Mencari saran…
    </p>

    <ul
      v-else-if="showSuggestions && suggestions.length"
      class="suggest"
    >
      <li
        v-for="(s, idx) in suggestions"
        :key="`${s.keyword}-${idx}`"
      >
        <button
          type="button"
          @click="goSearch(s.keyword)"
        >
          <span class="suggest-icon">⌕</span>
          <span class="suggest-text">
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

    <EmptyState
      v-else-if="q.trim() && !loading"
      title="Tidak ada saran"
      message="Tekan Cari untuk melihat hasil anime & video."
    />
  </div>
</template>

<style scoped>
.search-form {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.search-bar {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.search-bar.focused {
  border-color: var(--accent-border);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.glyph {
  color: var(--text-muted);
}

.search-input {
  flex: 1;
  min-width: 0;
  padding: 12px 0;
  border: 0;
  background: transparent;
  color: var(--text);
  outline: none;
}

.clear-btn {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 4px;
}

.hint {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.suggest {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-elevated);
}

.suggest li + li {
  border-top: 1px solid var(--border-subtle);
}

.suggest button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  padding: 12px 14px;
  border: 0;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.suggest button:hover {
  background: var(--bg-muted);
}

.suggest-icon {
  color: var(--text-muted);
  flex: 0 0 auto;
}

.suggest-text {
  min-width: 0;
  line-height: 1.35;
}

.nm {
  color: var(--text-secondary);
}

.hl {
  color: var(--accent);
  font-weight: 700;
}
</style>
