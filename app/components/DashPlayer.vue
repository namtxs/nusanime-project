<script setup lang="ts">
import type { VideoQuality } from '~/types/anime'

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
  const sub = player?.context?.ui?.subtitle
  if (!sub || applyingSubtitles) return

  const sources = buildSubtitleSources()
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
}

async function boot() {
  if (!hostRef.value || !import.meta.client || !props.uri) return

  const [{ default: Player }, { default: ui }, { default: dash }] = await Promise.all([
    import('@oplayer/core'),
    import('@oplayer/ui'),
    import('@oplayer/dash'),
  ])

  const sources = buildSubtitleSources()

  player = Player.make(hostRef.value, {
    source: {
      src: props.uri,
      format: 'dash',
    },
    autoplay: props.autoPlay !== false,
    crossorigin: true,
  })
    .use([
      ui({
        theme: {
          primaryColor: '#9147ff',
        },
        subtitle: {
          source: sources,
          background: false,
          fontSize: 28,
          bottom: '8%',
          marginBottom: '3.4em',
          shadow:
            '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, -2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000',
          onChange: (item: OPlayerSubtitleSource) => loadSubtitleText(item),
        },
      }),
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

  registerPlayerSettings()

  player.on('loadedmetadata', () => {
    if (!ready && props.initialPosition && props.initialPosition > 1) {
      player.seek(props.initialPosition)
    }
    ready = true
    registerPlayerSettings()
    applySubtitles()
    emit('ready')
  })

  // Subtitle.destroy() is bound to videosourcechange — restore after dash attaches.
  player.on('videosourcechanged', () => {
    window.setTimeout(applySubtitles, 0)
  })

  player.on('timeupdate', () => {
    emit('progress', {
      currentTime: player.currentTime || 0,
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
    if (!player || !url) return
    try {
      await player.changeSource({ src: url, format: 'dash' }, true)
      applySubtitles()
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
    registerPlayerSettings()
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

.player-host :deep(.oplayer) {
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
</style>
