<script setup lang="ts">
import type { VideoQuality } from '~/types/anime'

export type DashSubtitleTrack = {
  url: string
  label?: string
  language?: string
  isDefault?: boolean
  type?: 'vtt' | 'srt' | 'ass' | 'auto'
}

export type SkipRange = { start: number; end: number }
export type SkipMarkers = {
  intro?: SkipRange
  outro?: SkipRange
}

type SubtitleSource = {
  name: string
  src: string
  type: 'vtt'
  default?: boolean
}

const props = defineProps<{
  uri: string
  autoPlay?: boolean
  initialPosition?: number
  subtitles?: DashSubtitleTrack[]
  preferredSubtitleLang?: string
  qualities?: VideoQuality[]
  selectedQuality?: number
  servers?: { key: string; label: string }[]
  selectedServer?: string
  skip?: SkipMarkers
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
}>()

const hostRef = ref<HTMLDivElement | null>(null)
let player: any = null
let ready = false
let applyingSubtitles = false
let skippedIntro = false
let skippedOutro = false
let skipKind: 'intro' | 'outro' | null = null
let skipBtn: HTMLButtonElement | null = null

function validRange(range?: SkipRange): SkipRange | null {
  if (!range) return null
  const start = Number(range.start)
  const end = Number(range.end)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start + 0.5) return null
  return { start, end }
}

function inRange(range: SkipRange, time: number, pad = 0.4) {
  return time >= range.start && time < range.end - pad
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

function buildSubtitleSources(): SubtitleSource[] {
  const tracks = (props.subtitles || []).filter((s) => !!s.url)
  if (!tracks.length) return []

  const preferred = pickPreferredSubtitle(tracks, props.preferredSubtitleLang || 'id')
  const sources = tracks.map((track) => ({
    name: track.label || track.language || 'Subtitle',
    src: track.url,
    type: 'vtt' as const,
    default: preferred ? track.url === preferred.url : !!track.isDefault,
  }))

  if (!sources.some((s) => s.default)) sources[0].default = true
  return sources
}

async function loadSubtitleText(source: SubtitleSource) {
  const res = await fetch(source.src)
  if (!res.ok) throw new Error(`fetch failed (${res.status})`)
  const text = (await res.text()).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!text.trim()) throw new Error('Empty Subtitle')
  return /^WEBVTT/m.test(text) ? text : `WEBVTT\n\n${text}`
}

const QUALITY_KEY = 'quality'
const SERVER_KEY = 'server'

function registerPlayerSettings() {
  const setting = player?.context?.ui?.setting
  if (!setting) return

  try {
    setting.unregister(QUALITY_KEY)
    setting.unregister(SERVER_KEY)
  } catch {
    // ignore
  }

  const qualities = (props.qualities || []).filter((q) => q && (q.text || q.key != null))
  if (qualities.length) {
    setting.register({
      name: 'Quality',
      key: QUALITY_KEY,
      type: 'selector',
      icon: player.context.ui.icons?.quality,
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
    setting.register({
      name: 'Server',
      key: SERVER_KEY,
      type: 'selector',
      icon: player.context.ui.icons?.lang,
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
  if (!sub || applyingSubtitles || !sources.length) return

  applyingSubtitles = true
  try {
    sub.changeSource(sources)
  } catch {
    // ignore
  } finally {
    applyingSubtitles = false
  }

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
}

function applySkipHighlights() {
  const ui = player?.context?.ui
  if (!ui?.changHighlightSource) return
  const marks: { text: string; time: number }[] = []
  const intro = validRange(props.skip?.intro)
  const outro = validRange(props.skip?.outro)
  if (intro) marks.push({ text: 'OP', time: intro.start })
  if (outro) marks.push({ text: 'ED', time: outro.start })
  try {
    ui.changHighlightSource(marks)
  } catch {
    // ignore
  }
}

function ensureSkipButton() {
  if (skipBtn || !player?.$root) return
  skipBtn = document.createElement('button')
  skipBtn.type = 'button'
  skipBtn.className = 'nusa-skip'
  skipBtn.hidden = true
  skipBtn.addEventListener('click', (event) => {
    event.stopPropagation()
    if (skipKind === 'intro') skipIntroNow()
    else if (skipKind === 'outro') skipOutroNow()
  })
  player.$root.appendChild(skipBtn)
}

function hideSkip() {
  skipKind = null
  if (skipBtn) {
    skipBtn.hidden = true
    skipBtn.textContent = ''
  }
}

function showSkip(kind: 'intro' | 'outro') {
  ensureSkipButton()
  skipKind = kind
  if (!skipBtn) return
  skipBtn.hidden = false
  skipBtn.textContent = kind === 'intro' ? 'Skip intro' : 'Skip outro'
}

function skipIntroNow() {
  const intro = validRange(props.skip?.intro)
  if (!intro || !player) return
  skippedIntro = true
  hideSkip()
  player.seek(intro.end)
  try {
    player.context?.ui?.notice?.('Intro skipped')
  } catch {
    // ignore
  }
}

function skipOutroNow() {
  if (!player) return
  skippedOutro = true
  hideSkip()
  const duration = Number(player.duration) || 0
  if (duration > 0) player.seek(Math.max(0, duration - 0.05))
  else emit('ended')
}

function resetSkipState() {
  skippedIntro = false
  skippedOutro = false
  hideSkip()
}

function handleSkip(time: number) {
  const intro = validRange(props.skip?.intro)
  const outro = validRange(props.skip?.outro)

  if (intro && time >= intro.end - 0.15) skippedIntro = true
  if (outro && time >= outro.end - 0.15) skippedOutro = true

  const inIntro = !!(intro && !skippedIntro && inRange(intro, time))
  const inOutro = !!(outro && !skippedOutro && inRange(outro, time))

  if (props.autoSkip !== false) {
    if (inIntro) {
      skipIntroNow()
      return
    }
    if (inOutro) {
      skipOutroNow()
      return
    }
    hideSkip()
    return
  }

  if (inIntro) showSkip('intro')
  else if (inOutro) showSkip('outro')
  else hideSkip()
}

async function boot() {
  if (!hostRef.value || !import.meta.client || !props.uri) return

  const [{ default: Player }, { default: ui }, { default: dash }] = await Promise.all([
    import('@nusaplayer/core'),
    import('@nusaplayer/ui'),
    import('@nusaplayer/dash'),
  ])

  const sources = buildSubtitleSources()
  const uiOptions: Record<string, unknown> = {
    theme: { primaryColor: '#9147ff' },
  }
  if (sources.length) {
    uiOptions.subtitle = {
      source: sources,
      background: false,
      fontSize: 28,
      bottom: '8%',
      marginBottom: '3.4em',
      shadow:
        '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, -2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000',
      onChange: (item: SubtitleSource) => loadSubtitleText(item),
    }
  }

  player = Player.make(hostRef.value, {
    source: {
      src: props.uri,
      format: 'dash',
    },
    autoplay: props.autoPlay !== false,
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

  ensureSkipButton()
  registerPlayerSettings()
  applySkipHighlights()

  player.on('loadedmetadata', () => {
    if (!ready && props.initialPosition && props.initialPosition > 1) {
      player.seek(props.initialPosition)
    }
    ready = true
    registerPlayerSettings()
    applySubtitles()
    applySkipHighlights()
    emit('ready')
  })

  const restoreSubtitles = () => window.setTimeout(applySubtitles, 0)
  player.on('videosourcechange', restoreSubtitles)
  player.on('videosourcechanged', restoreSubtitles)

  player.on('timeupdate', () => {
    const currentTime = player.currentTime || 0
    const duration = player.duration || 0
    emit('progress', { currentTime, duration })
    handleSkip(currentTime)
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
  skipBtn = null
  skipKind = null
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
  ready = false
}

watch(
  () => props.uri,
  async (url) => {
    resetSkipState()
    if (!player || !url) return
    try {
      await player.changeSource({ src: url, format: 'dash' }, true)
      applySubtitles()
      applySkipHighlights()
    } catch (e: any) {
      emit('error', e?.message || 'Failed to switch stream')
    }
  }
)

watch(
  () => props.subtitles,
  () => applySubtitles(),
  { deep: true }
)

watch(
  () => [props.qualities, props.selectedQuality, props.servers, props.selectedServer] as const,
  () => registerPlayerSettings(),
  { deep: true }
)

watch(
  () => props.skip,
  () => {
    resetSkipState()
    applySkipHighlights()
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

.player-host :deep(:first-child) {
  width: 100%;
  height: 100%;
}

.player-host :deep([aria-label='Subtitle']) {
  z-index: 8;
  font-weight: 700;
}

.player-host :deep([aria-label='Subtitle'] span) {
  background: transparent !important;
  padding: 0;
}

.player-host :deep(.nusa-skip) {
  position: absolute;
  right: 16px;
  bottom: 72px;
  z-index: 30;
  width: auto;
  height: auto;
  border: 0;
  border-radius: 999px;
  padding: 8px 16px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
  background: rgba(20, 20, 24, 0.82);
  backdrop-filter: blur(8px);
  cursor: pointer;
}

.player-host :deep(.nusa-skip:hover) {
  background: #9147ff;
}
</style>
