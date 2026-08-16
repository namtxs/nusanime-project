<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    disabled?: boolean
    loading?: boolean
    rootMargin?: string
  }>(),
  {
    disabled: false,
    loading: false,
    rootMargin: '400px 0px',
  }
)

const emit = defineEmits<{
  visible: []
}>()

const el = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function setup() {
  observer?.disconnect()
  observer = null
  if (!import.meta.client || !el.value || props.disabled) return

  observer = new IntersectionObserver(
    (entries) => {
      if (props.disabled) return
      if (entries.some((e) => e.isIntersecting)) emit('visible')
    },
    {
      root: null,
      rootMargin: props.rootMargin,
      threshold: 0,
    }
  )
  observer.observe(el.value)
}

watch(
  () => [props.disabled, props.rootMargin] as const,
  async () => {
    await nextTick()
    setup()
  }
)

onMounted(async () => {
  await nextTick()
  setup()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div
    ref="el"
    class="infinite-sentinel"
    aria-hidden="true"
  >
    <div
      v-if="loading"
      class="infinite-hint"
    >
      <span class="dot" />
      Memuat…
    </div>
  </div>
</template>

<style scoped>
.infinite-sentinel {
  min-height: 24px;
  display: flex;
  justify-content: center;
  padding: 16px 0 8px;
}

.infinite-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.dot {
  width: 14px;
  height: 14px;
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
