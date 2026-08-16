<script setup lang="ts">
const { source } = useAmbientBg()
</script>

<template>
  <div
    class="ambient"
    aria-hidden="true"
  >
    <div class="wash" />
    <img
      v-if="source"
      :key="source"
      class="art"
      :src="source"
      alt=""
    >
    <div class="veil" />
  </div>
</template>

<style scoped>
.ambient {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.wash {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 90% 55% at 50% -8%, rgba(145, 71, 255, 0.16), transparent 58%),
    radial-gradient(ellipse 45% 40% at 100% 10%, rgba(119, 44, 232, 0.1), transparent 60%),
    radial-gradient(ellipse 40% 35% at 0% 85%, rgba(145, 71, 255, 0.07), transparent 62%);
}

.art {
  position: absolute;
  inset: -12%;
  width: 124%;
  height: 124%;
  object-fit: cover;
  object-position: center 20%;
  filter: blur(48px) saturate(1.45);
  opacity: 0.42;
  transform: scale(1.08);
}

.veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      rgba(var(--bg-rgb), 0.38) 0%,
      rgba(var(--bg-rgb), 0.74) 48%,
      rgba(var(--bg-rgb), 0.94) 100%
    ),
    rgba(var(--bg-rgb), 0.28);
}
</style>
