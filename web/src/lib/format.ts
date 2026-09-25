/** Format & parsing angka gaya Indonesia (titik ribuan, koma desimal). */

const nf = (desimal: number) =>
  new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  })

export function angka(nilai: number | null | undefined, desimal = 2): string {
  if (nilai == null || Number.isNaN(nilai)) return '—'
  return nf(desimal).format(nilai)
}

/** Bilangan desimal tanpa nol berekor: 17707.00 -> "17.707", 1500.5 -> "1.500,5" */
export function angkaRingkas(nilai: number | null | undefined, maksDesimal = 2): string {
  if (nilai == null || Number.isNaN(nilai)) return '—'
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: maksDesimal }).format(nilai)
}

export function rupiah(nilai: number | null | undefined): string {
  if (nilai == null || Number.isNaN(nilai)) return '—'
  return `Rp ${angka(Math.round(nilai), 0)}`
}

export function persen(nilai: number | null | undefined, desimal = 2): string {
  if (nilai == null || Number.isNaN(nilai)) return '—'
  return `${angka(nilai, desimal)}%`
}

/** Hapus semua kecuali digit dan pemisah. */
function hanyaAngka(teks: string): string {
  return teks.replace(/[^\d.,]/g, '')
}

/**
 * Rapikan input jadi format Indonesia sambil diketik.
 * Titik tunggal yang bukan pengelompokan ribuan diperlakukan sebagai desimal,
 * jadi "1500.5" tetap terbaca 1.500,5.
 */
export function rapikanAngka(teks: string, desimal = false): string {
  let t = hanyaAngka(teks)
  t = t.replace(/\.(?=\d{3}(?:[.,]|$))/g, '')
  if (t.indexOf(',') === -1 && t.indexOf('.') !== -1) t = t.replace('.', ',')

  const bagian = t.split(',')
  const bulat = (bagian[0] ?? '').replace(/\D/g, '')
  const bulatRapi = bulat.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  if (!desimal) return bulatRapi
  if (bagian.length === 1) return bulatRapi
  const pecahan = bagian.slice(1).join('').replace(/\D/g, '').slice(0, 2)
  return `${bulatRapi},${pecahan}`
}

/** Ubah teks berformat Indonesia jadi number. */
export function parseAngka(teks: string | number | null | undefined): number {
  if (typeof teks === 'number') return Number.isFinite(teks) ? teks : 0
  if (!teks) return 0

  let t = hanyaAngka(String(teks))
  t = t.replace(/\.(?=\d{3}(?:[.,]|$))/g, '')
  if (t.indexOf(',') === -1 && t.indexOf('.') !== -1) t = t.replace('.', ',')
  const bagian = t.split(',')
  const bulat = (bagian[0] ?? '').replace(/\D/g, '')
  const pecahan = bagian.length > 1 ? bagian.slice(1).join('').replace(/\D/g, '') : ''
  const n = Number(pecahan ? `${bulat}.${pecahan}` : bulat)
  return Number.isFinite(n) ? n : 0
}

export function tanggalPanjang(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export const BULAN_SINGKAT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]
