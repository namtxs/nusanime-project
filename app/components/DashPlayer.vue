<script setup lang="ts">
import { Lock, LockOpen, Pause, Play, RotateCcw, RotateCw } from 'lucide-vue-next'
import type { VideoQuality } from '~/types/anime'
import { lucidePlayerIcons } from '~/utils/lucidePlayerIcons'
import { decryptResponse, isEncryptedEnvelope } from '~/utils/responseCipher'

export type DashSubtitleTrack = {
  url: string
  label?: string
  language?: string
  isDefault?: boolean
  type?: 'vtt' | 'srt' | 'ass' | 'auto'
}

type OPlayerSubtitleSource = {
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
let applyingSubtitles = false
let dashBlobUrl = ''
let skippedIntro = false
let skippedOutro = false
const responseAesKey = getResponseAesKey()
const skipCue = ref<'intro' | 'outro' | null>(null)
const skipEnabled = ref(props.autoSkip !== false)
const controlsLocked = ref(false)
const showUnlockBtn = ref(false)
const isPlaying = ref(false)
const showCenterControls = ref(true)
const playerRoot = ref<HTMLElement | null>(null)
let unlockHideTimer = 0
const SKIP_KEY = 'skip-intro'
const SEEK_STEP = 10

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
    name: available ? 'Skip intro/outro' : 'Skip intro/outro',
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
      showNotice(value ? 'Skip intro on' : 'Skip intro off')
    },
  })

  window.setTimeout(markSkipSettingState, 0)
}

function resetSkipState() {
  skippedIntro = false
  skippedOutro = false
  skipCue.value = null
}

function inSkipRange(time: number, range?: SkipRange) {
  if (!range) return false
  return time >= range.start && time < range.end - 1
}

function showNotice(message: string) {
  try {
    player?.context?.ui?.notice?.(message)
  } catch {
    // ignore
  }
}

function seekBy(delta: number) {
  if (!player || controlsLocked.value || player.hasError) return
  const duration = Number(player.duration) || 0
  const current = Number(player.currentTime) || 0
  const next =
    duration > 0
      ? Math.min(Math.max(0, current + delta), duration)
      : Math.max(0, current + delta)
  player.seek(next)
  showNotice(delta < 0 ? '−10s' : '+10s')
}

function onLockKeydown(e: KeyboardEvent) {
  if (!controlsLocked.value) return
  const key = e.key
  if (
    key === ' ' ||
    key === 'Escape' ||
    /^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|[kKfFwWmMsS])$/.test(key)
  ) {
    e.preventDefault()
    e.stopImmediatePropagation()
  }
}

function clearUnlockHideTimer() {
  if (!unlockHideTimer) return
  window.clearTimeout(unlockHideTimer)
  unlockHideTimer = 0
}

function revealUnlock() {
  if (!controlsLocked.value) return
  showUnlockBtn.value = true
  clearUnlockHideTimer()
  unlockHideTimer = window.setTimeout(() => {
    showUnlockBtn.value = false
    unlockHideTimer = 0
  }, 2000)
}

function hideUnlockSoon() {
  clearUnlockHideTimer()
  unlockHideTimer = window.setTimeout(() => {
    showUnlockBtn.value = false
    unlockHideTimer = 0
  }, 300)
}

function setControlsLocked(locked: boolean) {
  controlsLocked.value = locked
  showCenterControls.value = !locked
  showUnlockBtn.value = false
  clearUnlockHideTimer()
  const root = player?.$root as HTMLElement | undefined
  if (root) {
    root.classList.toggle('nusa-locked', locked)
    root.setAttribute('data-nusa-locked', locked ? 'true' : 'false')
  }
  if (locked) {
    skipCue.value = null
    try {
      player?.$root?.setAttribute('data-ctrl-hidden', 'true')
    } catch {
      // ignore
    }
    showNotice('Player locked')
  } else {
    showNotice('Player unlocked')
  }
}

function unlockPlayer() {
  setControlsLocked(false)
}

function togglePlay() {
  if (!player || controlsLocked.value) return
  player.togglePlay()
}

function skipTo(range?: SkipRange, asEnded = false) {
  if (!range || !player) return
  if (asEnded) {
    showNotice('Outro skipped')
    emit('ended')
    return
  }
  player.seek(Math.max(0, range.end))
  showNotice('Intro skipped')
}

function handleSkip(time: number) {
  const intro = props.skip?.intro
  const outro = props.skip?.outro

  if (inSkipRange(time, intro) && !skippedIntro) {
    if (skipEnabled.value) {
      skippedIntro = true
      skipCue.value = null
      skipTo(intro)
      return
    }
    if (controlsLocked.value) return
    skipCue.value = 'intro'
    return
  }

  if (inSkipRange(time, outro) && !skippedOutro) {
    if (controlsLocked.value) return
    skipCue.value = 'outro'
    return
  }

  if (skipCue.value === 'intro' && !inSkipRange(time, intro)) skipCue.value = null
  if (skipCue.value === 'outro' && !inSkipRange(time, outro)) skipCue.value = null
}

function onSkipClick() {
  if (skipCue.value === 'intro') {
    skippedIntro = true
    skipTo(props.skip?.intro)
  } else if (skipCue.value === 'outro') {
    skippedOutro = true
    skipTo(props.skip?.outro, true)
  }
  skipCue.value = null
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
    revokeDashBlob()
    const blob = new Blob([xml], { type: 'application/dash+xml' })
    dashBlobUrl = URL.createObjectURL(blob)
    return dashBlobUrl
  }

  if (isEncryptedEnvelope(raw) && !responseAesKey) {
    throw new Error('Missing NUXT_PUBLIC_RESPONSE_AES_KEY')
  }

  return uri
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

/** OPlayer SubtitleSource — registered in Settings → Subtitle */
function buildSubtitleSources(): OPlayerSubtitleSource[] {
  const tracks = (props.subtitles || []).filter((s) => !!s.url)
  if (!tracks.length) return []

  const preferred = pickPreferredSubtitle(tracks, props.preferredSubtitleLang || 'id')

  const sources = tracks.map((track) => ({
    name: track.label || track.language || 'Subtitle',
    src: track.url,
    type: 'vtt' as const,
    default: preferred ? track.url === preferred.url : !!track.isDefault,
  }))

  if (!sources.some((s) => s.default)) {
    sources[0].default = true
  }

  return sources
}

async function loadSubtitleText(source: OPlayerSubtitleSource) {
  const res = await fetch(source.src)
  if (!res.ok) throw new Error(`fetch failed (${res.status})`)
  const text = (await res.text()).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!text.trim()) throw new Error('Empty Subtitle')
  return /^WEBVTT/m.test(text) ? text : `WEBVTT\n\n${text}`
}

const MENU_SUBTITLE = 'Subtitle'
const MENU_QUALITY = 'Quality'
const MENU_SERVER = 'Server'

function detachSettingEntries() {
  const setting = player?.context?.ui?.setting
  if (!setting) return
  for (const key of [MENU_SUBTITLE, 'quality', 'server', MENU_QUALITY, MENU_SERVER]) {
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
    ui.menu.unregister(MENU_SUBTITLE)
    ui.menu.unregister(MENU_QUALITY)
    ui.menu.unregister(MENU_SERVER)
  } catch {
    // ignore
  }

  const tracks = buildSubtitleSources()
  if (tracks.length) {
    const currentSrc = ui.subtitle?.currentSubtitle?.src
    ui.menu.register({
      name: MENU_SUBTITLE,
      icon: ui.icons?.subtitle,
      position: 'bottom',
      children: [
        { name: 'Off', default: !currentSrc, value: null },
        ...tracks.map((track) => ({
          name: track.name,
          default: currentSrc ? currentSrc === track.src : !!track.default,
          value: track,
        })),
      ],
      onChange(item: { value?: OPlayerSubtitleSource | null }) {
        const sub = ui.subtitle
        if (!item?.value) {
          sub?.hide?.()
          return
        }
        if (item.value.src === sub?.currentSubtitle?.src) {
          sub.show?.()
          return
        }
        sub.currentSubtitle = item.value
        if (sub.$dom) sub.$dom.innerHTML = ''
        void sub.fetchSubtitle?.()
      },
    })
  }

  const qualities = (props.qualities || []).filter((q) => q && (q.text || q.key != null))
  if (qualities.length) {
    ui.menu.register({
      name: MENU_QUALITY,
      icon: ui.icons?.quality,
      position: 'bottom',
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
      icon: ui.icons?.lang,
      position: 'bottom',
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
  if (!sub || applyingSubtitles) {
    registerPlayerMenus()
    return
  }
  if (!sources.length) {
    registerPlayerMenus()
    return
  }

  applyingSubtitles = true
  try {
    sub.changeSource(sources)
  } catch {
    // ignore
  } finally {
    applyingSubtitles = false
  }

  // dash.js strips <track>; OPlayer only calls show() on track "load".
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

async function boot() {
  if (!hostRef.value || !import.meta.client || !props.uri) return

  const [{ default: Player }, { default: ui }, { default: dash }] = await Promise.all([
    import('@oplayer/core'),
    import('@oplayer/ui'),
    import('@oplayer/dash'),
  ])

  const sources = buildSubtitleSources()
  const uiOptions: Record<string, unknown> = {
    theme: {
      primaryColor: '#9147ff',
      controller: {
        header: true,
        coverButton: false,
      },
      progress: {
        backward: SEEK_STEP,
        forward: SEEK_STEP,
      },
    },
    highlight: {
      color: '#fff',
      source: buildSkipHighlights(),
    },
    icons: lucidePlayerIcons,
  }
  if (sources.length) {
    uiOptions.subtitle = {
      source: sources,
      background: false,
      fontSize: 22,
      fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif',
      bottom: '8%',
      marginBottom: '3.4em',
      shadow:
        '-2px -2px 0 #3a1570, 2px -2px 0 #3a1570, -2px 2px 0 #3a1570, 2px 2px 0 #3a1570, -2px 0 0 #3a1570, 2px 0 0 #3a1570, 0 -2px 0 #3a1570, 0 2px 0 #3a1570',
      onChange: (item: OPlayerSubtitleSource) => loadSubtitleText(item),
    }
  }

  const src = await resolveDashSource(props.uri)

  player = Player.make(hostRef.value, {
    source: {
      src,
      format: 'dash',
      title: props.title || '',
      poster: props.poster || '',
    },
    autoplay: props.autoPlay !== false,
    crossorigin: true,
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

  registerPlayerMenus()
  registerSkipSetting()
  applyHighlights()
  playerRoot.value = player.$root
  document.addEventListener('keydown', onLockKeydown, true)

  player.on('play', () => {
    isPlaying.value = true
  })
  player.on('pause', () => {
    if (controlsLocked.value) {
      player.play?.()
      return
    }
    isPlaying.value = false
  })
  player.on('controlsshown', () => {
    if (controlsLocked.value) {
      showCenterControls.value = false
      player.$root?.setAttribute('data-ctrl-hidden', 'true')
      return
    }
    showCenterControls.value = true
  })
  player.on('controlshidden', () => {
    showCenterControls.value = false
  })

  player.context?.ui?.keyboard?.register?.({
    ARROWLEFT: () => seekBy(-SEEK_STEP),
    ARROWRIGHT: () => seekBy(SEEK_STEP),
    ' ': () => {
      if (!controlsLocked.value) player.togglePlay()
    },
    K: () => {
      if (!controlsLocked.value) player.togglePlay()
    },
  })

  player.on('loadedmetadata', () => {
    if (!ready && props.initialPosition && props.initialPosition > 1) {
      player.seek(props.initialPosition)
    }
    ready = true
    applySubtitles()
    applyHighlights()
    emit('ready')
  })

  // Subtitle.destroy() is bound to videosourcechange — restore after dash attaches.
  player.on('videosourcechanged', () => {
    window.setTimeout(() => {
      applySubtitles()
      applyHighlights()
    }, 0)
  })

  player.on('timeupdate', () => {
    const currentTime = player.currentTime || 0
    handleSkip(currentTime)
    emit('progress', {
      currentTime,
      duration: player.duration || 0,
    })
  })

  player.on('ended', () => emit('ended'))
  player.on('play', () => emit('playingChange', true))
  player.on('pause', () => emit('playingChange', false))
  player.on('error', (payload: any) => {
    const message =
      payload?.payload?.message ||
      payload?.message ||
      (typeof payload === 'string' ? payload : 'Playback error')
    emit('error', String(message))
  })
}

function hardStop() {
  clearUnlockHideTimer()
  showUnlockBtn.value = false
  document.removeEventListener('keydown', onLockKeydown, true)
  if (!player) return
  try {
    player.pause?.()
  } catch {
    // ignore
  }
  try {
    player.destroy?.()
  } catch {
    // ignore
  }
  player = null
  playerRoot.value = null
  ready = false
  controlsLocked.value = false
  isPlaying.value = false
  showCenterControls.value = true
  resetSkipState()
  revokeDashBlob()
}

function applySourceMeta() {
  if (!player) return
  if (props.poster) player.setPoster?.(props.poster)
  const titleEl = hostRef.value?.querySelector<HTMLElement>('.oplayer h2')
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
    if (!player || !url) return
    try {
      resetSkipState()
      const src = await resolveDashSource(url)
      await player.changeSource(
        {
          src,
          format: 'dash',
          title: props.title || '',
          poster: props.poster || '',
        },
        true
      )
      applySubtitles()
      applyHighlights()
    } catch (e: any) {
      emit('error', e?.message || 'Failed to switch stream')
    }
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
    skipEnabled.value = value !== false
  }
)

watch(
  () => [props.skip, skipEnabled.value] as const,
  () => {
    registerSkipSetting()
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
  <div
    class="player-wrap"
    :class="{ 'is-locked': controlsLocked }"
  >
    <div ref="hostRef" class="player-host" />
    <Teleport
      v-if="playerRoot"
      :to="playerRoot"
    >
      <div
        v-show="showCenterControls && !controlsLocked"
        class="center-controls"
      >
        <button
          type="button"
          class="center-btn center-lock"
          aria-label="Lock player"
          @click.stop="setControlsLocked(true)"
        >
          <Lock
            :size="22"
            :stroke-width="2.25"
            aria-hidden="true"
          />
        </button>
        <div class="center-cluster">
          <button
            type="button"
            class="center-btn seek-btn"
            aria-label="Rewind 10 seconds"
            @click.stop="seekBy(-SEEK_STEP)"
          >
            <span class="seek-glyph">
              <RotateCcw
                :size="44"
                :stroke-width="2.25"
                aria-hidden="true"
              />
              <span class="seek-num">10</span>
            </span>
          </button>
          <button
            type="button"
            class="center-btn center-play"
            :aria-label="isPlaying ? 'Pause' : 'Play'"
            @click.stop="togglePlay"
          >
            <Pause
              v-if="isPlaying"
              :size="36"
              :stroke-width="2.25"
              aria-hidden="true"
            />
            <Play
              v-else
              :size="36"
              :stroke-width="2.25"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            class="center-btn seek-btn"
            aria-label="Forward 10 seconds"
            @click.stop="seekBy(SEEK_STEP)"
          >
            <span class="seek-glyph">
              <RotateCw
                :size="44"
                :stroke-width="2.25"
                aria-hidden="true"
              />
              <span class="seek-num">10</span>
            </span>
          </button>
        </div>
      </div>
      <div
        v-show="controlsLocked"
        class="lock-shield"
        :class="{ 'is-reveal': showUnlockBtn }"
        @pointermove="revealUnlock"
        @pointerleave="hideUnlockSoon"
        @click.stop.prevent="revealUnlock"
        @dblclick.stop.prevent
      >
        <button
          type="button"
          class="center-btn center-lock unlock-btn"
          aria-label="Unlock player"
          @click.stop="unlockPlayer"
        >
          <LockOpen
            :size="22"
            :stroke-width="2.25"
            aria-hidden="true"
          />
        </button>
      </div>
    </Teleport>
    <button
      v-if="skipCue && !controlsLocked"
      type="button"
      class="skip-btn"
      @click="onSkipClick"
    >
      {{ skipCue === 'intro' ? 'Skip intro' : 'Skip outro' }}
    </button>
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

.skip-btn {
  position: absolute;
  right: 16px;
  bottom: 64px;
  z-index: 12;
  border: 0;
  border-radius: 6px;
  padding: 10px 14px;
  background: rgba(20, 20, 20, 0.88);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
}

.skip-btn:hover {
  background: #fff;
  color: #111;
}

.center-controls,
.lock-shield {
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
}

.lock-shield {
  z-index: 99;
  pointer-events: auto;
  cursor: default;
}

.center-cluster {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 96px;
  pointer-events: none;
}

.center-btn {
  pointer-events: auto;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border: 0;
  border-radius: 50%;
  padding: 0;
  background: rgba(20, 20, 20, 0.55);
  color: #fff;
  cursor: pointer;
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.center-lock,
.unlock-btn {
  position: absolute;
  left: 16px;
  top: 50%;
  width: 40px;
  height: 40px;
  background: rgba(20, 20, 20, 0.28);
  transform: translateY(-50%);
}

.center-lock :deep(svg),
.unlock-btn :deep(svg) {
  width: 22px;
  height: 22px;
  display: block;
}

.seek-btn {
  width: 52px;
  height: 52px;
  background: rgba(20, 20, 20, 0.28);
}

.seek-glyph {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
}

.seek-glyph :deep(svg) {
  display: block;
  width: 44px;
  height: 44px;
}

.seek-num {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.05em;
  line-height: 1;
  pointer-events: none;
}

.center-play {
  width: 80px;
  height: 80px;
  background: rgba(145, 71, 255, 0.92);
}

.center-play :deep(svg) {
  width: 36px;
  height: 36px;
  display: block;
}

.center-btn:hover {
  background: rgba(20, 20, 20, 0.45);
}

.seek-btn:hover {
  background: rgba(20, 20, 20, 0.4);
}

.center-lock:hover,
.unlock-btn:hover {
  background: rgba(20, 20, 20, 0.4);
  transform: translateY(-50%) scale(1.06);
}

.seek-btn:hover,
.center-play:hover {
  transform: scale(1.06);
}

.center-play:hover {
  background: rgb(145, 71, 255);
}

.unlock-btn {
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.15s ease, background-color 0.15s ease;
}

.lock-shield:hover .unlock-btn,
.lock-shield.is-reveal .unlock-btn {
  opacity: 1;
  pointer-events: auto;
}

.player-host :deep(.nusa-locked > div:not(.lock-shield):not(.center-controls) > *:not([aria-label='Subtitle'])),
.is-locked .player-host :deep(.oplayer > div:not(.lock-shield):not(.center-controls) > *:not([aria-label='Subtitle'])) {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

.player-host {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}

.player-host :deep(.oplayer) {
  width: 100%;
  height: 100%;
}

.player-host :deep(.oplayer button:not(.center-btn) svg) {
  fill: none;
  stroke: currentColor;
  width: 1.2em;
  height: 1.2em;
  display: block;
  margin: auto;
}

.player-host :deep(.oplayer h2) {
  font-size: 0.95rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.player-host :deep(.oplayer > [aria-label='Subtitle']),
.player-host :deep(.oplayer > [aria-label='Subtitle'] p),
.player-host :deep(.oplayer > [aria-label='Subtitle'] span) {
  z-index: 8;
  font-family: 'Arial Black', 'Arial Bold', Arial, sans-serif !important;
  font-weight: 900 !important;
  -webkit-text-stroke: 0.55px #3a1570;
  paint-order: stroke fill;
}

.player-host :deep(.oplayer > [aria-label='Subtitle'] span) {
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
