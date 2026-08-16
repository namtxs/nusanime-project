<script setup lang="ts">
defineProps<{
  title?: string
  message?: string
}>()
</script>

<template>
  <div class="state-box">
    <h3>{{ title || 'Nothing here' }}</h3>
    <p>{{ message || 'No items to show.' }}</p>
  </div>
</template>
