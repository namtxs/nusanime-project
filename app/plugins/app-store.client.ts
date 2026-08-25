export default defineNuxtPlugin(() => {
  hydrateApiConfig()
  const store = useAppStore()
  if (import.meta.client) {
    store.hydrate()
  }
})
