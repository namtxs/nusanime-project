export function asArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  return []
}

export function unwrapData(payload: any): any {
  if (!payload) return payload
  if (payload.data !== undefined && (payload.code !== undefined || payload.ttl !== undefined)) {
    return payload.data
  }
  return payload
}

export function unwrapAnimeCards(payload: any): any[] {
  const data = unwrapData(payload)
  if (Array.isArray(data)) return data.filter(Boolean)
  const candidates = [data?.cards, data?.list, data?.items_v2, data?.items, data?.recommend]
  for (const c of candidates) {
    const arr = asArray(c)
    if (arr.length) return arr.filter(Boolean)
  }
  return []
}

export function isUgcCard(card: any): boolean {
  if (!card) return false
  const type = String(card.card_type || card.cardType || '').toLowerCase()
  const goto = String(card.goto || '').toLowerCase()
  if (type === 'ugc' || goto === 'av') return true
  if (
    type === 'ogv' ||
    goto === 'bangumi' ||
    goto === 'pgc' ||
    goto === 'season' ||
    goto === 'ogv'
  ) {
    return false
  }
  if (card.season_id != null || card.seasonId != null) return false
  if (card.aid != null || card.avid != null) return true
  return false
}

export function isDracinCard(card: any): boolean {
  if (!card) return false
  if (card.source === 'dracin') return true
  if (isUgcCard(card)) return false
  const link = String(card.link || card.uri || '')
  if (/shorts\/ogv|\/shorts\//i.test(link)) return true
  if (Number(card.season_type) === 5) return true
  if (typeof card.styles === 'string' && card.styles.trim().length > 0) return false
  const styleList = asArray(card?.styles?.style)
  if (styleList.length > 0) return false
  return false
}

/** Series detail heuristic — empty/null styles → Dracin short drama. */
export function isDracinSeriesDetail(detail: any): boolean {
  if (!detail) return false
  if (detail.source === 'dracin') return true
  const styles = detail?.details?.styles
  const styleList = asArray(styles?.style)
  if (styleList.length > 0) return false
  if (styles == null) return true
  return false
}

function extractStyleLabels(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return asArray(value)
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>
        const label = rec.title || rec.name || rec.text
        return typeof label === 'string' ? label.trim() : ''
      }
      return ''
    })
    .filter(Boolean)
}

export function displayBadge(value: unknown): string {
  const raw =
    typeof value === 'object' && value
      ? String((value as { text?: unknown }).text || '').trim()
      : value != null
        ? String(value).trim()
        : ''
  if (!raw) return ''
  if (/bstation|bilibili/i.test(raw)) return 'Eksklusif'
  return raw
}

export function mapCardToAnime(card: any) {
  if (!card) return null

  const ugc = isUgcCard(card)
  const rawOid = card.oid ?? card.param

  const aid = ugc
    ? card.aid ?? card.avid ?? rawOid
    : card.aid ?? card.avid ?? card.bvid
  const seasonId = ugc ? undefined : card.season_id ?? card.seasonId ?? rawOid

  const badgeText = displayBadge(card.badge)
  const tagText = displayBadge(card.tag)

  const authorName =
    typeof card.author === 'string'
      ? card.author
      : card.author?.name || card.author?.uname || undefined

  const styleLabels = extractStyleLabels(card.styles || card.style_list)
  const stylesText = styleLabels.length ? styleLabels.join(' · ') : undefined
  const desc = [card.evaluate, card.desc, card.description, card.sub_title]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0)

  const subtitleCandidate =
    card.subtitle ||
    card.index_show ||
    card.stat?.view ||
    card.views ||
    card.view ||
    stylesText ||
    authorName

  const subtitle =
    subtitleCandidate != null && typeof subtitleCandidate !== 'object'
      ? String(subtitleCandidate)
      : undefined

  return {
    season_id: seasonId != null ? String(seasonId) : undefined,
    aid: aid != null ? String(aid) : undefined,
    oid: rawOid != null ? String(rawOid) : undefined,
    card_type:
      typeof card.card_type === 'string'
        ? card.card_type
        : ugc
          ? 'ugc'
          : card.card_type != null
            ? String(card.card_type)
            : undefined,
    goto: card.goto != null ? String(card.goto) : undefined,
    title: String(card.title || card.name || 'Untitled'),
    cover: card.cover || card.square_cover || card.horizontal_cover || card.pic,
    square_cover: card.square_cover || card.cover || card.pic,
    horizontal_cover: card.horizontal_cover || card.cover || card.pic,
    subtitle,
    desc,
    styles: styleLabels,
    rank_order: card.rank_order != null ? String(card.rank_order) : undefined,
    badge: badgeText || tagText || undefined,
    badge_type: card.badge_type,
    ...(!ugc && isDracinCard({ ...card, season_id: seasonId })
      ? { source: 'dracin' as const }
      : null),
  }
}

export function unwrapSuggestions(payload: any): Array<{
  keyword: string
  type?: string
  match?: Array<{ str: string; match: boolean }>
}> {
  const data = unwrapData(payload)
  const items = asArray(data?.items ?? data?.list ?? data)
  return items
    .map((item: any) => ({
      keyword: String(item?.keyword || item?.title || item?.str || '').trim(),
      type: item?.type != null ? String(item.type) : undefined,
      match: asArray(item?.match)
        .map((part: any) => ({
          str: String(part?.str ?? (typeof part === 'string' ? part : '')),
          match: Boolean(part?.match),
        }))
        .filter((part) => part.str.length > 0),
    }))
    .filter((item) => item.keyword.length > 0)
}

export function unwrapSearchModules(payload: any): {
  modules: Array<{ type?: string; title?: string; items: any[] }>
  hasNext: boolean
} {
  const data = unwrapData(payload)
  let modules = asArray(data?.modules)

  // result-anime returns flat items
  if (modules.length === 0 && asArray(data?.items).length > 0) {
    modules = [{ type: 'ogv', title: 'Anime', items: data.items }]
  }

  const normalized = modules
    .map((mod: any) => ({
      type: mod?.type,
      title: mod?.title || mod?.type || 'Results',
      items: asArray(mod?.items).map(mapCardToAnime).filter(Boolean),
    }))
    .filter((mod) => mod.items.length > 0)

  const hasNext = Boolean(Number(data?.has_next ?? 0))
  return { modules: normalized, hasNext }
}

export function unwrapSchedule(payload: any): Array<{
  date: string
  date_ts?: number
  day_of_week: number
  episodes: any[]
}> {
  const root =
    payload?.data !== undefined && Array.isArray(payload.data)
      ? payload
      : unwrapData(payload)
  const days = Array.isArray(root)
    ? root
    : asArray(root?.data ?? root?.result ?? root?.days)

  const toJsDow = (dow: number) => {
    const n = Number(dow)
    if (!Number.isFinite(n)) return 0
    if (n === 7) return 0
    if (n >= 1 && n <= 6) return n
    return n
  }

  return days
    .filter(Boolean)
    .map((day: any) => {
      const episodes = asArray(day.episodes)
        .map((ep: any) => ({
          ...ep,
          season_id: ep.season_id != null ? String(ep.season_id) : undefined,
          episode_id: ep.episode_id != null ? String(ep.episode_id) : undefined,
          title: ep.title || 'Untitled',
          cover: ep.cover || ep.square_cover,
          square_cover: ep.square_cover || ep.cover,
          pub_time: ep.pub_time || ep.pub_time_show,
          pub_index: ep.pub_index || ep.EpIndex,
          pub_ts: Number(ep.pub_ts) || 0,
          published: Number(ep.published) === 1,
        }))
        .sort((a, b) => (a.pub_ts || 0) - (b.pub_ts || 0))

      return {
        date: String(day.date ?? ''),
        date_ts: Number(day.date_ts) || 0,
        day_of_week: toJsDow(day.day_of_week),
        episodes,
      }
    })
    .sort((a, b) => a.date_ts - b.date_ts)
}

export function unwrapRelated(payload: any): any[] {
  const data = unwrapData(payload)
  if (Array.isArray(payload?.list)) {
    return payload.list.map(mapCardToAnime).filter(Boolean)
  }
  if (Array.isArray(data?.list)) {
    return data.list.map(mapCardToAnime).filter(Boolean)
  }
  if (Array.isArray(data?.recommend?.list)) {
    return data.recommend.list.map(mapCardToAnime).filter(Boolean)
  }
  if (Array.isArray(payload?.recommend?.list)) {
    return payload.recommend.list.map(mapCardToAnime).filter(Boolean)
  }
  if (Array.isArray(data)) return data.map(mapCardToAnime).filter(Boolean)
  if (Array.isArray(data?.recommend)) {
    return data.recommend.map(mapCardToAnime).filter(Boolean)
  }
  if (Array.isArray(payload?.recommend)) {
    return payload.recommend.map(mapCardToAnime).filter(Boolean)
  }
  return unwrapAnimeCards(data).map(mapCardToAnime).filter(Boolean)
}

export function extractEpisodes(detail: any): any[] {
  const eps: any[] = []
  const sections = detail?.sections?.section
  if (Array.isArray(sections)) {
    sections.forEach((section: any) => {
      asArray(section?.ep_details).forEach((ep: any) => {
        if (ep) eps.push(ep)
      })
    })
  }
  if (eps.length === 0 && Array.isArray(detail?.episodes)) {
    return detail.episodes
  }
  return eps
}

export type EpisodeSection = {
  key: string
  title: string
  start_ep_id?: number | string
  end_ep_id?: number | string
  size?: number
  episodes: any[]
}

export function extractEpisodeSections(detail: any): EpisodeSection[] {
  const raw = detail?.sections?.section
  if (Array.isArray(raw) && raw.length > 0) {
    const sections = raw
      .map((section: any, index: number) => {
        const episodes = asArray(section?.ep_details).filter(Boolean)
        const title = section?.title || section?.ep_list_title || `Bag ${index + 1}`
        return {
          key: String(section?.start_ep_id ?? section?.title ?? index),
          title: String(title),
          start_ep_id: section?.start_ep_id,
          end_ep_id: section?.end_ep_id,
          size: section?.size ?? episodes.length,
          episodes,
        } as EpisodeSection
      })
      .filter((s: EpisodeSection) => s.episodes.length > 0)

    if (sections.length > 0) return sections
  }

  const flat = extractEpisodes(detail)
  if (flat.length === 0) return []
  return [{ key: 'all', title: 'All episodes', size: flat.length, episodes: flat }]
}

export function extractStyles(detail: any): string[] {
  if (Array.isArray(detail?.styles) && typeof detail.styles[0] === 'string') {
    return detail.styles
  }
  const fromDetails = asArray(detail?.details?.styles?.style)
  if (fromDetails.length) {
    return fromDetails.map((s: any) => s?.title).filter(Boolean)
  }
  const fromInfo = asArray(detail?.info?.tag)
  if (fromInfo.length) {
    return fromInfo.map((t: any) => t?.name || t?.title || t).filter(Boolean)
  }
  return []
}

export function extractDescription(detail: any): string {
  return (
    detail?.details?.desc?.value ||
    detail?.evaluate ||
    detail?.desc ||
    detail?.description ||
    ''
  )
}

export function normalizeSkip(skip: any): {
  intro?: { start: number; end: number }
  outro?: { start: number; end: number }
} {
  if (!skip || typeof skip !== 'object') return {}

  if (skip.intro || skip.outro) {
    return {
      intro: skip.intro
        ? { start: Number(skip.intro.start) || 0, end: Number(skip.intro.end) || 0 }
        : undefined,
      outro: skip.outro
        ? { start: Number(skip.outro.start) || 0, end: Number(skip.outro.end) || 0 }
        : undefined,
    }
  }

  const values = [
    skip.opening_start_time,
    skip.opening_end_time,
    skip.ending_start_time,
    skip.ending_end_time,
  ]
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0)

  const treatAsMs = values.length > 0 && values.every((n) => n >= 10_000)

  const toSec = (v: any) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) return 0
    return treatAsMs ? n / 1000 : n
  }

  const introStart = toSec(skip.opening_start_time)
  const introEnd = toSec(skip.opening_end_time)
  const outroStart = toSec(skip.ending_start_time)
  const outroEnd = toSec(skip.ending_end_time)

  return {
    intro: introEnd > introStart ? { start: introStart, end: introEnd } : undefined,
    outro: outroEnd > outroStart ? { start: outroStart, end: outroEnd } : undefined,
  }
}

export function extractRelatedFromDetail(detail: any): any[] {
  const candidates = [
    detail?.for_you?.item_details,
    detail?.for_you?.items,
    detail?.relate?.item_details,
    detail?.related?.item_details,
    detail?.recommend?.list,
    detail?.recommend,
  ]
  for (const raw of candidates) {
    const list = asArray(raw).map(mapCardToAnime).filter(Boolean)
    if (list.length) return list
  }
  return []
}
