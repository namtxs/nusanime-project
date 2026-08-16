const source = ref('')

export function useAmbientBg() {
  const setAmbient = (url?: string | null) => {
    source.value = typeof url === 'string' ? url.trim() : ''
  }

  const clearAmbient = () => {
    source.value = ''
  }

  return {
    source,
    setAmbient,
    clearAmbient,
  }
}
