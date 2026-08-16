<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<template>
  <div class="state-box">
    <div class="spinner" />
    <p>{{ message || 'Loading…' }}</p>
  </div>
</template>

<style scoped>
.spinner {
  width: 28px;
  height: 28px;
  margin: 0 auto 12px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
