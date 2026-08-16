<script setup lang="ts">
defineProps<{
  title?: string
  message?: string
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="state-box">
    <h3>{{ title || 'Something went wrong' }}</h3>
    <p>{{ message || 'Please try again.' }}</p>
    <button class="btn btn-primary" type="button" @click="emit('retry')">Retry</button>
  </div>
</template>
