<script setup lang="ts">
import type { Anime } from '~/types/anime'

const store = useAppStore()
store.hydrate()

const items = computed(() =>
  store.favorites.value.map(
    (f) =>
      ({
        season_id: f.season_id,
        title: f.title,
        cover: f.cover,
        square_cover: f.cover,
      }) as Anime
  )
)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">My List</h1>
    </div>
    <p class="page-lead">Judul yang kamu simpan.</p>

    <EmptyState
      v-if="!items.length"
      title="List kosong"
      message="Simpan judul dari halaman detail anime."
    />
    <div
      v-else
      class="grid-cards"
    >
      <AnimeCard
        v-for="item in items"
        :key="item.season_id"
        :anime="item"
      />
    </div>
  </div>
</template>
