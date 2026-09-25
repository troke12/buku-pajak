import { useTahunAktif } from '@/lib/tahun'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  judul: string
  lede: string
  aksi?: React.ReactNode
}

export function PageHeader({ judul, lede, aksi }: Props) {
  const { tahun, setTahun, tahunOpsi } = useTahunAktif()

  return (
    <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        <SidebarTrigger className="mt-1 shrink-0" />
        <Separator orientation="vertical" className="mt-1 !h-6 data-[orientation=vertical]:h-6" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{judul}</h1>
          <p className="text-muted-foreground max-w-[68ch] text-sm">{lede}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="pilih-tahun"
            className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase"
          >
            Tahun pajak
          </label>
          <Select value={tahun} onValueChange={setTahun}>
            <SelectTrigger id="pilih-tahun" className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tahunOpsi.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {aksi}
      </div>
    </header>
  )
}
