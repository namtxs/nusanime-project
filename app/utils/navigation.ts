import { contentService } from '~/services/contentService'

type OpenableTitle = {
  season_id?: string | number | null
  aid?: string | number | null
  oid?: string | number | null
  param?: string | number | null
  card_type?: string | null
  goto?: string | null
  source?: string | null
  link?: string | null
  uri?: string | null
  season_type?: string | number | null
  styles?: unknown
}

type NavOpts = { replace?: boolean }

function go(path: string, opts?: NavOpts) {
  if (opts?.replace) void navigateTo(path, { replace: true })
  else void navigateTo(path)
}

/**
 * Route titles like Expo openTitle:
 * UGC → /video-ugc/:aid
 * Dracin → /video/:ep?seasonId=&source=dracin (web uses episode player; Expo uses feed)
 * OGV → /anime/:seasonId
 */
export function openTitle(item: OpenableTitle, opts?: NavOpts) {
  if (isUgcCard(item)) {
    const id = item.aid ?? item.oid ?? item.param
    if (id != null && String(id).length > 0) {
      go(`/video-ugc/${id}`, opts)
    }
    return
  }

  if (item.season_id != null && String(item.season_id).length > 0) {
    if (isDracinCard(item) || item.source === 'dracin') {
      void openSeasonPlay(item.season_id, {
        source: 'dracin',
        replace: opts?.replace,
      }).catch((e) => console.error('Dracin open failed', e))
      return
    }
    go(`/anime/${item.season_id}`, opts)
    return
  }

  if (item.aid != null && String(item.aid).length > 0) {
    go(`/video-ugc/${item.aid}`, opts)
  }
}

export async function openSeasonPlay(
  seasonId: string | number,
  opts?: { episodeId?: string | number; source?: string; replace?: boolean }
) {
  const sid = String(seasonId || '').trim()
  if (!sid) return

  let episodeId = opts?.episodeId != null ? String(opts.episodeId) : ''
  let source = opts?.source || ''

  if (!episodeId || !source) {
    const detail = await contentService.getSeriesDetail(sid)
    if (!source && isDracinSeriesDetail(detail)) {
      source = 'dracin'
    }
    if (!episodeId) {
      const episodes = extractEpisodes(detail)
      const first = episodes[0]
      episodeId = first?.episode_id != null ? String(first.episode_id) : ''
    }
  }

  if (!episodeId) {
    throw new Error('No episode available for this title')
  }

  const qs = new URLSearchParams({ seasonId: sid })
  if (source) qs.set('source', source)
  go(`/video/${episodeId}?${qs.toString()}`, { replace: opts?.replace })
}

export function openHistoryPlay(item: {
  episode_id: string | number
  season_id: string | number
  source?: string | null
}) {
  const episodeId = String(item.episode_id || '').trim()
  const seasonId = String(item.season_id || '').trim()
  if (!episodeId) return

  if (String(item.source || '').toLowerCase() === 'ugc') {
    void navigateTo(`/video-ugc/${episodeId}`)
    return
  }

  if (!seasonId) return

  const qs = new URLSearchParams({ seasonId })
  if (item.source) qs.set('source', String(item.source))
  void navigateTo(`/video/${episodeId}?${qs.toString()}`)
}

export function openSearchItem(item: any) {
  openTitle(item)
}
