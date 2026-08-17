<script setup lang="ts">
const { checking, installed, installUrl, check } = useExtension()
</script>

<template>
  <div class="gate">
    <slot v-if="installed" />

    <div
      v-else
      class="panel"
    >
      <div
        class="mark"
        aria-hidden="true"
      >
        N
      </div>

      <p
        v-if="checking"
        class="status"
      >
        Checking extension…
      </p>

      <template v-else>
        <h2>Install the extension to watch</h2>
        <p class="copy">
          Download the zip, unzip it, then Load unpacked in chrome://extensions.
        </p>
        <div class="actions">
          <a
            class="btn primary"
            :href="installUrl"
            download
          >
            Download
          </a>
          <button
            type="button"
            class="btn"
            @click="check"
          >
            Already installed?
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.gate {
  width: 100%;
}

.panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  aspect-ratio: 16 / 9;
  padding: 28px 24px;
  border-radius: var(--radius-md);
  background: #000;
  text-align: center;
}

.mark {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: #fff;
  font-size: 1.25rem;
  font-weight: 800;
}

.status,
.copy {
  margin: 0;
  max-width: 26rem;
  color: var(--text-secondary);
  font-size: 0.9375rem;
  line-height: 1.5;
}

h2 {
  margin: 6px 0 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 0.875rem;
  font-weight: 700;
}

.btn.primary {
  border-color: transparent;
  background: var(--accent);
  color: #fff;
}

.btn.primary:hover {
  background: var(--accent-hover);
}
</style>
