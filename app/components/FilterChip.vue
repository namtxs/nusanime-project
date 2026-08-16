<script setup lang="ts">
defineProps<{
  label: string
  active?: boolean
}>()

const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="chip"
    :class="{ active }"
    @click="emit('click')"
  >
    {{ label }}
  </button>
</template>

<style scoped>
.chip {
  flex: 0 0 auto;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-muted);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.2;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.chip:hover:not(.active) {
  border-color: var(--accent-border);
  color: var(--text);
}

.chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
  font-weight: 700;
}
</style>
