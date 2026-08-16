/**
 * Genre keys must match backend `GENRE_STYLE_MAP` / VALIDATION.GENRE.ALLOWED
 * (src/constants/index.js). Do not invent keys the API rejects.
 */
export const ANIME_GENRES = [
  { key: 'semua', label: 'Semua' },
  { key: 'kisah_asli', label: 'Kisah Asli' },
  { key: 'adaptasi_komik', label: 'Adaptasi Komik' },
  { key: 'adaptasi_novel', label: 'Adaptasi Novel' },
  { key: 'adaptasi_permainan', label: 'Adaptasi Permainan' },
  { key: 'tokusatsu', label: 'Tokusatsu' },
  { key: 'berjuang', label: 'Berjuang' },
  { key: 'isekai', label: 'Isekai' },
  { key: 'supranatural', label: 'Supranatural' },
  { key: 'perjalanan_waktu', label: 'Perjalanan Waktu' },
  { key: 'fantasi', label: 'Fantasi' },
  { key: 'aksi', label: 'Aksi' },
  { key: 'komedi', label: 'Komedi' },
  { key: 'harian', label: 'Harian' },
  { key: 'fiksi_ilmiah', label: 'Fiksi Ilmiah' },
  { key: 'moe', label: 'Moe' },
  { key: 'pemulihan', label: 'Pemulihan' },
  { key: 'sekolah', label: 'Sekolah' },
  { key: 'anak_anak', label: 'Anak-anak' },
  { key: 'romantis', label: 'Romantis' },
  { key: 'shoujo', label: 'Shoujo' },
  { key: 'petualangan', label: 'Petualangan' },
  { key: 'sejarah', label: 'Sejarah' },
  { key: 'mecha', label: 'Mecha' },
  { key: 'olahraga', label: 'Olahraga' },
  { key: 'inspiratif', label: 'Inspiratif' },
  { key: 'musik', label: 'Musik' },
  { key: 'tegang', label: 'Tegang' },
  { key: 'idola', label: 'Idola' },
  { key: 'lingkungan_kerja', label: 'Lingkungan Kerja' },
  { key: 'makanan', label: 'Makanan' },
  { key: 'kuno_cina', label: 'Kuno Cina' },
  { key: 'fantasi_misteri', label: 'Fantasi Misteri' },
  { key: 'budidaya', label: 'Budidaya' },
  { key: 'balas_dendam', label: 'Balas Dendam' },
  { key: 'misteri', label: 'Misteri' },
  { key: 'terharu', label: 'Terharu' },
  { key: 'seni_bela_diri', label: 'Seni Bela Diri' },
  { key: 'harem', label: 'Harem' },
  { key: 'furry', label: 'Furry' },
  { key: '18+', label: '18+' },
  { key: 'yaoi', label: 'Yaoi' },
  { key: 'yuri', label: 'Yuri' },
  { key: 'urban', label: 'Urban' },
  { key: 'balapan', label: 'Balapan' },
  { key: 'modern', label: 'Modern' },
  { key: 'plot', label: 'Plot' },
] as const

export type AnimeGenreKey = (typeof ANIME_GENRES)[number]['key']

export const TRENDING_TYPES = [
  { key: 'umum', label: 'Umum' },
  { key: 'premium', label: 'Premium' },
  { key: 'berjuang', label: 'Berjuang' },
  { key: 'isekai', label: 'Isekai' },
  { key: 'fantasi', label: 'Fantasi' },
  { key: 'aksi', label: 'Aksi' },
  { key: 'komedi', label: 'Komedi' },
  { key: 'romantis', label: 'Romantis' },
  { key: 'petualangan', label: 'Petualangan' },
  { key: 'olahraga', label: 'Olahraga' },
  { key: 'tegang', label: 'Tegang' },
  { key: 'kuno_cina', label: 'Kuno Cina' },
  { key: 'harem', label: 'Harem' },
] as const

/** Map featuredList `function` deep-links → web routes */
export function mapFeaturedFunctionUri(uri?: string | null): string {
  const u = String(uri || '').toLowerCase()
  if (u.includes('timeline') || u.includes('schedule') || u.includes('jadwal')) {
    return '/schedule'
  }
  if (u.includes('rank') || u.includes('top')) return '/trending'
  if (u.includes('vip') || u.includes('premium')) return '/exclusive'
  if (u.includes('dracin') || u.includes('shorts')) return '/dracin'
  if (u.includes('index') || u.includes('browse')) return '/explore'
  return '/explore'
}
