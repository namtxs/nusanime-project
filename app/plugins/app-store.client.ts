export default defineNuxtPlugin(() => {
  const store = useAppStore()
  if (import.meta.client) {
    store.hydrate()
  }
})
