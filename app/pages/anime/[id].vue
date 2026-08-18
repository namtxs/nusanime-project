<script setup lang="ts">
const route = useRoute()
const store = useAppStore()
store.hydrate()

const seasonId = computed(() => String(route.params.id || ''))
const error = ref('')

onMounted(async () => {
  if (!seasonId.value) {
    error.value = 'Missing season id'
    return
  }
  try {
    const last = store.watchHistory.value.find(
      (h) => String(h.season_id) === seasonId.value
    )
    await openSeasonPlay(seasonId.value, {
      episodeId: last?.episode_id,
      source: last?.source || undefined,
      replace: true,
    })
  } catch (e: any) {
    error.value = e?.message || 'Gagal membuka episode'
  }
})
</script>

<template>
  <div class="page">
    <ErrorState
      v-if="error"
      :message="error"
    />
    <LoadingState
      v-else
      message="Membuka player…"
    />
  </div>
</template>
