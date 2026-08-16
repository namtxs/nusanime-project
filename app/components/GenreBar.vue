<script setup lang="ts">
defineProps<{
  items: Array<{ key: string; label: string }>
  modelValue: string
  ariaLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

function select(key: string) {
  emit('update:modelValue', key)
}
</script>

<template>
  <div
    class="genre-bar"
    role="tablist"
    :aria-label="ariaLabel || 'Genre'"
  >
    <FilterChip
      v-for="item in items"
      :key="item.key"
      :label="item.label"
      :active="modelValue === item.key"
      @click="select(item.key)"
    />
  </div>
</template>

<style scoped>
.genre-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0 12px;
}
</style>
