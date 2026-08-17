function hasExtensionMarker() {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.hasAttribute('data-nusanime-ext')
  )
}

export function useExtension() {
  const config = useRuntimeConfig()
  const installUrl = String(
    config.public.extensionInstallUrl || '/nusanime-extension.zip'
  ).trim()

  const checking = ref(true)
  const installed = ref(false)

  function check() {
    checking.value = true
    installed.value = hasExtensionMarker()
    checking.value = false
    return installed.value
  }

  onMounted(() => {
    check()
    window.addEventListener('focus', check)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('focus', check)
  })

  return {
    installUrl,
    checking,
    installed,
    check,
  }
}
