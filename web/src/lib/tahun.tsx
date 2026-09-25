import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { useTahun } from './query'

type KonteksTahun = {
  tahun: string
  setTahun: (t: string) => void
  tahunOpsi: string[]
}

const Konteks = createContext<KonteksTahun | null>(null)

const TAHUN_KINI = String(new Date().getFullYear())

export function PenyediaTahun({ children }: { children: React.ReactNode }) {
  const { data } = useTahun()
  const [tahun, setTahun] = useState(TAHUN_KINI)
  const [tersentuh, setTersentuh] = useState(false)

  const tahunOpsi = useMemo(() => {
    const daftar = data ?? [TAHUN_KINI]
    return daftar.includes(tahun) ? daftar : [tahun, ...daftar]
  }, [data, tahun])

  // begitu daftar tahun tersedia, pilih tahun berjalan kalau ada datanya
  useEffect(() => {
    if (!tersentuh && data?.length) {
      if (!data.includes(TAHUN_KINI)) setTahun(data[0])
    }
  }, [data, tersentuh])

  const nilai = useMemo(
    () => ({
      tahun,
      setTahun: (t: string) => {
        setTersentuh(true)
        setTahun(t)
      },
      tahunOpsi,
    }),
    [tahun, tahunOpsi],
  )

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>
}

export function useTahunAktif() {
  const ctx = useContext(Konteks)
  if (!ctx) throw new Error('useTahunAktif harus dipakai di dalam PenyediaTahun')
  return ctx
}
