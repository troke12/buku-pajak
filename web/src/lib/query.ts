import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Biaya, type PendapatanMasuk, type Pengaturan, type SetoranMasuk } from './api'

const kunci = {
  tahun: ['tahun'] as const,
  pengaturan: ['pengaturan'] as const,
  pendapatan: (tahun: string) => ['pendapatan', tahun] as const,
  setoran: (tahun: string) => ['setoran', tahun] as const,
  ringkasan: (tahun: string) => ['ringkasan', tahun] as const,
  biaya: (tahun: string) => ['biaya', tahun] as const,
}

export function useTahun() {
  return useQuery({ queryKey: kunci.tahun, queryFn: api.tahun, staleTime: 60_000 })
}

export function usePengaturan() {
  return useQuery({ queryKey: kunci.pengaturan, queryFn: api.pengaturan.ambil })
}

export function useSimpanPengaturan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Pengaturan) => api.pengaturan.simpan(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kunci.pengaturan })
      qc.invalidateQueries({ queryKey: ['ringkasan'] })
    },
  })
}

export function usePendapatan(tahun: string) {
  return useQuery({ queryKey: kunci.pendapatan(tahun), queryFn: () => api.pendapatan.daftar(tahun) })
}

function segarkanTahun(qc: ReturnType<typeof useQueryClient>, tahun: string) {
  qc.invalidateQueries({ queryKey: kunci.pendapatan(tahun) })
  qc.invalidateQueries({ queryKey: kunci.ringkasan(tahun) })
  qc.invalidateQueries({ queryKey: kunci.tahun })
}

export function useTambahPendapatan(tahun: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PendapatanMasuk) => api.pendapatan.tambah(data),
    onSuccess: () => segarkanTahun(qc, tahun),
  })
}

export function useUbahPendapatan(tahun: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PendapatanMasuk }) =>
      api.pendapatan.ubah(id, data),
    onSuccess: () => segarkanTahun(qc, tahun),
  })
}

export function useHapusPendapatan(tahun: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.pendapatan.hapus(id),
    onSuccess: () => segarkanTahun(qc, tahun),
  })
}

export function useSetoran(tahun: string) {
  return useQuery({ queryKey: kunci.setoran(tahun), queryFn: () => api.setoran.daftar(tahun) })
}

export function useTambahSetoran(tahun: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SetoranMasuk) => api.setoran.tambah(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kunci.setoran(tahun) })
      qc.invalidateQueries({ queryKey: kunci.ringkasan(tahun) })
      qc.invalidateQueries({ queryKey: kunci.tahun })
    },
  })
}

export function useHapusSetoran(tahun: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.setoran.hapus(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kunci.setoran(tahun) })
      qc.invalidateQueries({ queryKey: kunci.ringkasan(tahun) })
    },
  })
}

export function useRingkasan(tahun: string) {
  return useQuery({ queryKey: kunci.ringkasan(tahun), queryFn: () => api.ringkasan(tahun) })
}

export function useBiaya(tahun: string) {
  return useQuery({ queryKey: kunci.biaya(tahun), queryFn: () => api.biaya.ambil(tahun) })
}

export function useSimpanBiaya(tahun: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Biaya) => api.biaya.simpan(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kunci.biaya(tahun) })
      qc.invalidateQueries({ queryKey: kunci.ringkasan(tahun) })
    },
  })
}
