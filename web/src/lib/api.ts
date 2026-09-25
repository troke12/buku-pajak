/** Klien API tipis untuk backend FastAPI. */

export type Pendapatan = {
  id: number
  tanggal: string
  sumber: string
  idr: number
  bank: string | null
  catatan: string | null
}

export type PendapatanMasuk = Omit<Pendapatan, 'id'>

export type Setoran = {
  id: number
  tanggal: string
  jenis: string
  masa: string | null
  jumlah: number
  catatan: string | null
}

export type SetoranMasuk = Omit<Setoran, 'id'>

export type Pengaturan = {
  nama: string
  npwp: string
  status_ptkp: string
  mode_hitung: 'norma' | 'pembukuan'
  norma_persen: number
  bank_default: string
}

export type Biaya = { tahun: string; jumlah: number; catatan: string }

export type RincianLapisan = {
  dari: number
  sampai: number | null
  tarif: number
  dasar: number
  pajak: number
}

export type Ringkasan = {
  tahun: string
  bruto: number
  neto: number
  ptkp: number
  pkp: number
  pph: number
  kredit: number
  kurang_bayar: number
  pph25_bulanan: number
  status_ptkp: string
  mode: 'norma' | 'pembukuan'
  norma_persen: number
  biaya: number
  rincian: RincianLapisan[]
  per_bulan: number[]
  per_sumber: { sumber: string; total: number; jumlah_transaksi: number }[]
  per_bank: { bank: string; total: number; jumlah_transaksi: number }[]
  setoran_jenis: { jenis: string; total: number }[]
  setoran_jumlah: number
}

export class ApiError extends Error {
  status: number
  constructor(status: number, pesan: string) {
    super(pesan)
    this.status = status
    this.name = 'ApiError'
  }
}

async function minta<T>(jalur: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${jalur}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (res.status === 204) return undefined as T

  const teks = await res.text()
  const data = teks ? JSON.parse(teks) : null

  if (!res.ok) {
    const detail = data?.detail
    const pesan =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg: string }) => d.msg).join(', ')
          : `Permintaan gagal (${res.status})`
    throw new ApiError(res.status, pesan)
  }

  return data as T
}

export const api = {
  tahun: () => minta<string[]>('/tahun'),

  pengaturan: {
    ambil: () => minta<Pengaturan>('/pengaturan'),
    simpan: (data: Pengaturan) =>
      minta<Pengaturan>('/pengaturan', { method: 'PUT', body: JSON.stringify(data) }),
  },

  biaya: {
    ambil: (tahun: string) => minta<Biaya>(`/biaya?tahun=${tahun}`),
    simpan: (data: Biaya) =>
      minta<Biaya>('/biaya', { method: 'PUT', body: JSON.stringify(data) }),
  },

  pendapatan: {
    daftar: (tahun: string) => minta<Pendapatan[]>(`/pendapatan?tahun=${tahun}`),
    tambah: (data: PendapatanMasuk) =>
      minta<Pendapatan>('/pendapatan', { method: 'POST', body: JSON.stringify(data) }),
    ubah: (id: number, data: PendapatanMasuk) =>
      minta<Pendapatan>(`/pendapatan/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    hapus: (id: number) => minta<void>(`/pendapatan/${id}`, { method: 'DELETE' }),
  },

  setoran: {
    daftar: (tahun: string) => minta<Setoran[]>(`/setoran?tahun=${tahun}`),
    tambah: (data: SetoranMasuk) =>
      minta<Setoran>('/setoran', { method: 'POST', body: JSON.stringify(data) }),
    hapus: (id: number) => minta<void>(`/setoran/${id}`, { method: 'DELETE' }),
  },

  ringkasan: (tahun: string) => minta<Ringkasan>(`/ringkasan?tahun=${tahun}`),
}
