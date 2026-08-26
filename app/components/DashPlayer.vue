<script setup lang="ts">
import type { VideoQuality } from '~/types/anime'
import { decryptResponse, isEncryptedEnvelope } from '~/utils/responseCipher'

export type DashSubtitleTrack = {
  url: string
  label?: string
  language?: string
  isDefault?: boolean
  type?: 'vtt' | 'srt' | 'ass' | 'auto'
}

type PlayerSubtitleSource = {
  name: string
  src: string
  type: 'vtt'
  default?: boolean
}

export type SkipRange = { start: number; end: number }

const props = defineProps<{
  uri: string
  title?: string
  poster?: string
  autoPlay?: boolean
  initialPosition?: number
  subtitles?: DashSubtitleTrack[]
  preferredSubtitleLang?: string
  qualities?: VideoQuality[]
  selectedQuality?: number
  servers?: { key: string; label: string }[]
  selectedServer?: string
  skip?: { intro?: SkipRange; outro?: SkipRange }
  autoSkip?: boolean
}>()

const emit = defineEmits<{
  ready: []
  error: [message: string]
  progress: [payload: { currentTime: number; duration: number }]
  ended: []
  qualityChange: [key: number]
  serverChange: [key: string]
  playingChange: [playing: boolean]
  skipChange: [enabled: boolean]
}>()

const hostRef = ref<HTMLDivElement | null>(null)
let player: any = null
let ready = false
let booting = false
let applyingSubtitles = false
let dashBlobUrl = ''
let skippedIntro = false
let skippedOutro = false
let ending = false
let sourceGen = 0
let lastSubKey = ''
const responseAesKey = getResponseAesKey()
const skipEnabled = ref(props.autoSkip !== false)
const SKIP_KEY = 'skip-intro'

function hasSkipData() {
  const intro = props.skip?.intro
  const outro = props.skip?.outro
  return Boolean(
    (intro && intro.end > intro.start) || (outro && outro.end > outro.start)
  )
}

function buildSkipHighlights() {
  const items: { time: number; text: string }[] = []
  const intro = props.skip?.intro
  const outro = props.skip?.outro
  if (intro && intro.end > intro.start) {
    items.push({ time: intro.start, text: 'Intro' })
    items.push({ time: intro.end, text: 'Intro end' })
  }
  if (outro && outro.end > outro.start) {
    items.push({ time: outro.start, text: 'Outro' })
    items.push({ time: outro.end, text: 'Outro end' })
  }
  return items
}

function applyHighlights() {
  try {
    player?.context?.ui?.changHighlightSource?.(buildSkipHighlights())
  } catch {
    // ignore
  }
}

function markSkipSettingState() {
  const row = player?.$root?.querySelector(`[data-key="${SKIP_KEY}"]`) as HTMLElement | null
  if (!row) return
  if (hasSkipData()) {
    row.removeAttribute('aria-disabled')
    return
  }
  row.setAttribute('aria-disabled', 'true')
  row.setAttribute('aria-checked', 'false')
}

function registerSkipSetting() {
  const setting = player?.context?.ui?.setting
  if (!setting) return

  try {
    setting.unregister(SKIP_KEY)
  } catch {
    // ignore
  }

  const available = hasSkipData()
  setting.register({
    name: 'Lewati intro/outro',
    key: SKIP_KEY,
    type: 'switcher',
    default: available && skipEnabled.value,
    onChange(value: boolean) {
      if (!hasSkipData()) {
        markSkipSettingState()
        showNotice('Skip data tidak tersedia')
        return
      }
      skipEnabled.value = value
      emit('skipChange', value)
      showNotice(value ? 'Lewati intro/outro aktif' : 'Lewati intro/outro nonaktif')
    },
  })

  window.setTimeout(markSkipSettingState, 0)
}

function resetSkipState() {
  skippedIntro = false
  skippedOutro = false
  ending = false
}

function inSkipRange(time: number, range?: SkipRange) {
  if (!range) return false
  return time >= range.start && time < range.end - 1
}

function showNotice(message: string, id = 'nusa-notice') {
  try {
    player?.context?.ui?.notice?.(message, undefined, id)
  } catch {
    // ignore
  }
}

function isUiLocked() {
  if (!player?.$root) return false
  try {
    const unlock = player.locales.get('Unlock')
    return Boolean(player.$root.querySelector(`button[aria-label="${unlock}"]`))
  } catch {
    return false
  }
}

function skipTo(range?: SkipRange, asEnded = false) {
  if (!range || !player) return
  const kind = asEnded ? 'outro' : 'intro'
  showNotice(`Skipping ${kind}`, `skip-${kind}-start`)
  showNotice(`${kind === 'intro' ? 'Intro' : 'Outro'} skipped`, `skip-${kind}-done`)
  if (asEnded) {
    if (ending) return
    ending = true
    try {
      player.pause?.()
    } catch {
      // ignore
    }
    emit('ended')
    return
  }
  player.seek(Math.max(0, range.end))
}

function handleSkip(time: number) {
  if (!skipEnabled.value || isUiLocked()) return

  const intro = props.skip?.intro
  const outro = props.skip?.outro

  if (intro && intro.end > intro.start && time >= intro.end - 0.25) skippedIntro = true
  if (outro && outro.end > outro.start && time >= outro.end - 0.25) skippedOutro = true

  if (inSkipRange(time, intro) && !skippedIntro) {
    skippedIntro = true
    skipTo(intro)
    return
  }

  if (inSkipRange(time, outro) && !skippedOutro) {
    skippedOutro = true
    skipTo(outro, true)
  }
}

function revokeDashBlob() {
  if (!dashBlobUrl) return
  URL.revokeObjectURL(dashBlobUrl)
  dashBlobUrl = ''
}

async function resolveDashSource(uri: string): Promise<string> {
  const raw = await $fetch<unknown>(uri, { timeout: 30000 })

  if (typeof raw === 'string' && raw.includes('<MPD')) {
    return uri
  }

  const xml = await decryptResponse(raw, responseAesKey)
  if (typeof xml === 'string' && xml.includes('<MPD')) {
    const blob = new Blob([xml], { type: 'application/dash+xml' })
    return URL.createObjectURL(blob)
  }

  if (isEncryptedEnvelope(raw) && !responseAesKey) {
    throw new Error('Missing NUXT_PUBLIC_RESPONSE_AES_KEY')
  }

  return uri
}

function commitDashBlob(nextSrc: string) {
  if (dashBlobUrl && dashBlobUrl !== nextSrc) URL.revokeObjectURL(dashBlobUrl)
  dashBlobUrl = nextSrc.startsWith('blob:') ? nextSrc : ''
}

function discardBlob(src: string) {
  if (src.startsWith('blob:') && src !== dashBlobUrl) URL.revokeObjectURL(src)
}

function pickPreferredSubtitle(
  subtitles: DashSubtitleTrack[] | undefined,
  preferredLang: string
) {
  if (!subtitles?.length) return null
  const lang = preferredLang.toLowerCase()
  return (
    subtitles.find((s) => s.isDefault) ||
    subtitles.find((s) => String(s.language || '').toLowerCase() === lang) ||
    subtitles.find((s) => String(s.language || '').toLowerCase().startsWith(lang)) ||
    subtitles.find((s) => /indonesia|bahasa|\bid\b/i.test(`${s.label} ${s.language}`)) ||
    subtitles[0]
  )
}

/** NusaPlayer SubtitleSource — registered in Settings → Subtitle */
function buildSubtitleSources(): PlayerSubtitleSource[] {
  const tracks = (props.subtitles || []).filter((s) => !!s.url)
  if (!tracks.length) return []

  const byUrl = new Map<string, DashSubtitleTrack>()
  for (const track of tracks) {
    const url = track.url.replace(/#.*$/, '')
    if (!byUrl.has(url)) byUrl.set(url, { ...track, url })
  }

  const byLabel = new Map<string, DashSubtitleTrack>()
  for (const track of byUrl.values()) {
    const label = (track.label || track.language || 'Subtitle').trim().toLowerCase()
    const prev = byLabel.get(label)
    if (!prev || (!prev.isDefault && track.isDefault)) byLabel.set(label, track)
  }

  const unique = [...byLabel.values()]
  const preferred = pickPreferredSubtitle(unique, props.preferredSubtitleLang || 'id')

  const sources = unique.map((track) => ({
    name: track.label || track.language || 'Subtitle',
    src: track.url,
    type: 'vtt' as const,
    default: preferred ? track.url === preferred.url : !!track.isDefault,
  }))

  const first = sources[0]
  if (first && !sources.some((s) => s.default)) first.default = true

  return sources
}

async function loadSubtitleText(source: PlayerSubtitleSource) {
  const res = await fetch(source.src)
  if (!res.ok) throw new Error(`fetch failed (${res.status})`)
  const text = (await res.text()).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!text.trim()) throw new Error('Empty Subtitle')
  return /^WEBVTT/m.test(text) ? text : `WEBVTT\n\n${text}`
}

const MENU_QUALITY = 'Quality'
const MENU_SERVER = 'Server'
const SERVER_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3zm0 4.54c0 1.66 3.58 3 8 3s8-1.34 8-3V9.12C18.3 10.32 15.34 11 12 11s-6.3-.68-8-1.88v1.42zM4 16c0 1.66 3.58 3 8 3s8-1.34 8-3v-1.42C18.3 15.78 15.34 16.5 12 16.5s-6.3-.72-8-1.92V16z"/></svg>'

function detachSettingEntries() {
  const setting = player?.context?.ui?.setting
  if (!setting) return
  for (const key of ['quality', 'server', MENU_QUALITY, MENU_SERVER]) {
    try {
      setting.unregister(key)
    } catch {
      // ignore
    }
  }
}

function registerPlayerMenus() {
  const ui = player?.context?.ui
  if (!ui?.menu) return

  detachSettingEntries()

  try {
    ui.menu.unregister(MENU_QUALITY)
    ui.menu.unregister(MENU_SERVER)
  } catch {
    // ignore
  }

  const qualities = (props.qualities || []).filter((q) => q && (q.text || q.key != null))
  if (qualities.length) {
    ui.menu.register({
      name: player.locales?.get?.('Quality') || MENU_QUALITY,
      key: MENU_QUALITY,
      icon: ui.icons?.quality,
      position: 'bottom',
      anchor: 'settings',
      children: qualities.map((q) => ({
        name: String(q.text || `Level ${q.key}`),
        value: q.key,
        default: q.key === props.selectedQuality,
      })),
      onChange(item: { value?: number }) {
        const key = Number(item?.value)
        if (!Number.isNaN(key)) emit('qualityChange', key)
      },
    })
  }

  const servers = (props.servers || []).filter((s) => s?.key && s?.label)
  if (servers.length) {
    ui.menu.register({
      name: MENU_SERVER,
      key: MENU_SERVER,
      icon: SERVER_ICON,
      position: 'bottom',
      anchor: 'settings',
      children: servers.map((s) => ({
        name: s.label,
        value: s.key,
        default: s.key === props.selectedServer,
      })),
      onChange(item: { value?: string }) {
        if (item?.value) emit('serverChange', item.value)
      },
    })
  }
}

function applySubtitles() {
  const sources = buildSubtitleSources()
  const sub = player?.context?.ui?.subtitle
  const key = sources.map((s) => `${s.src}|${s.default ? 1 : 0}`).join(',')
  if (!sub || applyingSubtitles) {
    registerPlayerMenus()
    return
  }
  if (!sources.length) {
    if (lastSubKey) {
      try {
        sub.changeSource([])
      } catch {
        // ignore
      }
    }
    lastSubKey = ''
    registerPlayerMenus()
    return
  }
  if (key === lastSubKey && sub.currentSubtitle) {
    registerPlayerMenus()
    return
  }

  applyingSubtitles = true
  lastSubKey = key
  try {
    sub.changeSource(sources)
  } catch {
    lastSubKey = ''
  } finally {
    applyingSubtitles = false
  }

  // dash.js strips <track>; UI only calls show() on track "load".
  window.setTimeout(() => {
    try {
      const current = player?.context?.ui?.subtitle
      if (!current?.currentSubtitle) return
      const video: HTMLVideoElement | undefined = player?.$video
      if (!video) return
      if (!current.$track || !video.contains(current.$track)) {
        current.$track = undefined
        void current.fetchSubtitle?.()
        return
      }
      if (!current.isShow) current.show()
    } catch {
      // ignore
    }
  }, 400)

  detachSettingEntries()
  registerPlayerMenus()
}

async function applyStream(url: string, keepTime: boolean) {
  const gen = ++sourceGen
  let nextSrc = ''
  try {
    nextSrc = await resolveDashSource(url)
    if (gen !== sourceGen || !player) {
      discardBlob(nextSrc)
      return
    }

    const canKeep =
      keepTime &&
      ready &&
      (player.currentTime || 0) > 1 &&
      typeof player.changeQuality === 'function'

    if (!canKeep) {
      resetSkipState()
      lastSubKey = ''
    } else {
      ending = false
    }

    const source = {
      src: nextSrc,
      format: 'dash' as const,
      title: props.title || '',
      poster: props.poster || '',
    }

    if (canKeep) {
      await player.changeQuality({
        src: nextSrc,
        format: 'dash',
        title: props.title || '',
      })
    } else {
      await player.changeSource(source, true)
    }

    if (gen !== sourceGen || !player) {
      discardBlob(nextSrc)
      return
    }

    commitDashBlob(nextSrc)
    applySubtitles()
    applyHighlights()
    applySourceMeta()
  } catch (e: any) {
    discardBlob(nextSrc)
    if (gen !== sourceGen) return
    const message = e?.message || 'Failed to switch stream'
    if (message === 'Previous Source is Changing.') return
    emit('error', message)
    showNotice(message, 'player-error')
  }
}

async function boot() {
  if (!hostRef.value || !import.meta.client || !props.uri || player || booting) return
  booting = true

  try {
    const [{ default: Player }, { default: ui }, { default: dash }] = await Promise.all([
      import('@nusaplayer/core'),
      import('@nusaplayer/ui'),
      import('@nusaplayer/dash'),
    ])

    if (!hostRef.value) return

    const uiOptions: Record<string, unknown> = {
      theme: {
        primaryColor: '#9147ff',
        controller: {
          header: true,
          coverButton: true,
          setting: 'auto',
          displayBehavior: 'hover',
        },
        progress: {
          position: 'top',
          mini: true,
        },
      },
      screenshot: true,
      pictureInPicture: true,
      autoFocus: true,
      highlight: {
        color: '#fff',
        source: buildSkipHighlights(),
      },
      subtitle: {
        source: [],
        background: false,
        fontSize: 22,
        fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif',
        bottom: '8%',
        marginBottom: '3.4em',
        shadow:
          '-2px -2px 0 #3a1570, 2px -2px 0 #3a1570, -2px 2px 0 #3a1570, 2px 2px 0 #3a1570, -2px 0 0 #3a1570, 2px 0 0 #3a1570, 0 -2px 0 #3a1570, 0 2px 0 #3a1570',
        onChange: (item: PlayerSubtitleSource) => loadSubtitleText(item),
      },
    }

    const uriAtResolve = props.uri
    const src = await resolveDashSource(uriAtResolve)
    if (!hostRef.value) {
      discardBlob(src)
      return
    }

    commitDashBlob(src)

    player = Player.make(hostRef.value, {
      source: {
        src,
        format: 'dash',
        title: props.title || '',
        poster: props.poster || '',
      },
      autoplay: props.autoPlay !== false,
      playsinline: true,
      lang: 'id',
      videoAttr: { crossorigin: 'anonymous' },
    })
      .use([
        ui(uiOptions),
        dash({
          qualityControl: false,
          textControl: false,
          audioControl: true,
          config: {
            streaming: {
              abr: { autoSwitchBitrate: { audio: false, video: false } },
              text: { defaultEnabled: false },
              buffer: {
                fastSwitchEnabled: true,
                bufferToKeep: 24,
                initialBufferLevel: 4,
              },
            },
          } as any,
        }),
      ])
      .create()

    player.$root?.classList.add('nusa-player')
    registerPlayerMenus()
    registerSkipSetting()
    applyHighlights()

    player.on('loadedmetadata', () => {
      if (!player) return
      const firstReady = !ready
      if (firstReady && props.initialPosition && props.initialPosition > 1) {
        player.seek(props.initialPosition)
      }
      ready = true
      applySubtitles()
      applyHighlights()
      if (firstReady) emit('ready')
    })

    // Subtitle.destroy() is bound to videosourcechange — restore after dash attaches.
    player.on('videosourcechanged', () => {
      window.setTimeout(() => {
        if (!player) return
        lastSubKey = ''
        applySubtitles()
        applyHighlights()
      }, 0)
    })

    player.on('timeupdate', () => {
      if (!player) return
      const currentTime = player.currentTime || 0
      handleSkip(currentTime)
      emit('progress', {
        currentTime,
        duration: player.duration || 0,
      })
    })

    player.on('ended', () => {
      if (!player || ending) return
      ending = true
      emit('ended')
    })
    player.on('play', () => {
      if (player) emit('playingChange', true)
    })
    player.on('pause', () => {
      if (player) emit('playingChange', false)
    })
    player.on('error', (payload: any) => {
      if (!player) return
      const message =
        payload?.payload?.message ||
        payload?.message ||
        (typeof payload === 'string' ? payload : 'Playback error')
      const text = String(message)
      emit('error', text)
      showNotice(text, 'player-error')
    })

    if (props.uri && props.uri !== uriAtResolve) {
      await applyStream(props.uri, false)
    }
  } catch (e: any) {
    emit('error', e?.message || 'Failed to start player')
    hardStop()
  } finally {
    booting = false
  }
}

function hardStop() {
  lastSubKey = ''
  ready = false
  resetSkipState()
  if (!player) {
    revokeDashBlob()
    return
  }
  const instance = player
  player = null
  try {
    instance.pause?.()
  } catch {
    // ignore
  }
  try {
    void instance.destroy?.()
  } catch {
    // ignore
  }
  revokeDashBlob()
}

function applySourceMeta() {
  if (!player) return
  if (props.poster) player.setPoster?.(props.poster)
  const titleEl = player.$root && player.$root.querySelector('h2')
  if (titleEl) titleEl.textContent = props.title || ''
}

watch(
  () => [props.title, props.poster] as const,
  () => {
    applySourceMeta()
  }
)

watch(
  () => props.uri,
  async (url) => {
    if (!url) return
    if (!player) {
      void boot()
      return
    }
    await applyStream(url, true)
  }
)

watch(
  () => props.subtitles,
  () => {
    applySubtitles()
  },
  { deep: true }
)

watch(
  () => [props.qualities, props.selectedQuality, props.servers, props.selectedServer] as const,
  () => {
    registerPlayerMenus()
  },
  { deep: true }
)

watch(
  () => props.autoSkip,
  (value) => {
    const next = value !== false
    if (next === skipEnabled.value) return
    skipEnabled.value = next
    registerSkipSetting()
  }
)

watch(
  () => hasSkipData(),
  () => {
    registerSkipSetting()
    applyHighlights()
  }
)

watch(
  () => props.skip,
  () => {
    applyHighlights()
  },
  { deep: true }
)

onMounted(() => {
  void boot()
})

onBeforeUnmount(() => {
  hardStop()
})

defineExpose({
  seekTo: (seconds: number) => {
    player?.seek?.(Math.max(0, seconds))
  },
  play: () => void player?.play?.(),
  pause: () => player?.pause?.(),
})
</script>

<template>
  <div class="player-wrap">
    <div ref="hostRef" class="player-host" />
  </div>
</template>

<style scoped>
.player-wrap {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.player-host {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}

.player-host :deep(.nusa-player) {
  width: 100%;
  height: 100%;
}

.player-host :deep(.nusa-player h2) {
  font-size: 0.95rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.player-host :deep(.nusa-player [aria-label='Subtitle']),
.player-host :deep(.nusa-player [aria-label='Subtitle'] p),
.player-host :deep(.nusa-player [aria-label='Subtitle'] span) {
  z-index: 8;
  font-family: 'Arial Black', 'Arial Bold', Arial, sans-serif !important;
  font-weight: 900 !important;
  -webkit-text-stroke: 0.55px #3a1570;
  paint-order: stroke fill;
}

.player-host :deep(.nusa-player [aria-label='Subtitle'] span) {
  background: transparent !important;
}

.player-host :deep([data-dropdown-pos] [role='menu']) {
  min-width: 13em;
  width: max-content;
  max-width: 18rem;
  padding: 0.4em 0;
  box-sizing: border-box;
}

.player-host :deep([data-key='skip-intro'][aria-disabled='true']) {
  opacity: 0.38;
  pointer-events: none;
  cursor: not-allowed;
}

.player-host :deep([data-dropdown-pos] [role='menuitemradio']) {
  min-width: 13em;
  padding: 0 0.9em !important;
  text-align: left !important;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: normal;
}
</style>
