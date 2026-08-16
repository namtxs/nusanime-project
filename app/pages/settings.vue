<script setup lang="ts">
import type { StreamServerKey } from '~/utils/api'

const store = useAppStore()
store.hydrate()

function onQuality(e: Event) {
  store.setPreferredQuality(Number((e.target as HTMLSelectElement).value))
}

function onServer(e: Event) {
  store.setPreferredServer((e.target as HTMLSelectElement).value as StreamServerKey)
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
    </div>
    <p class="page-lead">Preferensi pemutaran dan data lokal.</p>

    <section class="card">
      <label class="field">
        <span>Kualitas preferensi</span>
        <select
          :value="store.preferredQuality.value"
          @change="onQuality"
        >
          <option
            v-for="q in VIDEO_QUALITY_OPTIONS"
            :key="q.value"
            :value="q.value"
          >
            {{ q.label }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Server preferensi</span>
        <select
          :value="store.preferredServer.value"
          @change="onServer"
        >
          <option
            v-for="s in SERVER_OPTIONS"
            :key="s.key"
            :value="s.key"
          >
            {{ s.label }}
          </option>
        </select>
      </label>

      <label class="toggle">
        <input
          type="checkbox"
          :checked="store.autoPlay.value"
          @change="store.setAutoPlay(($event.target as HTMLInputElement).checked)"
        >
        <span>Autoplay</span>
      </label>

      <label class="toggle">
        <input
          type="checkbox"
          :checked="store.skipIntro.value"
          @change="store.setSkipIntro(($event.target as HTMLInputElement).checked)"
        >
        <span>Skip intro (jika tersedia)</span>
      </label>
    </section>

    <section class="card">
      <h2 class="section-title">Data</h2>
      <p class="hint">Favorites tetap disimpan. History bisa dibersihkan.</p>
      <button
        class="btn"
        type="button"
        @click="store.clearHistory()"
      >
        Clear watch history
      </button>
    </section>
  </div>
</template>

<style scoped>
.card {
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.field select {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}

.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-size: 0.9375rem;
}

.hint {
  margin: -4px 0 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.section-title {
  margin: 0;
}
</style>
