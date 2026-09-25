import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  buka: boolean
  onBukaBerubah: (buka: boolean) => void
  judul: string
  pesan: string
  labelKonfirmasi?: string
  sibuk?: boolean
  onKonfirmasi: () => void
}

export function DialogKonfirmasi({
  buka,
  onBukaBerubah,
  judul,
  pesan,
  labelKonfirmasi = 'Hapus',
  sibuk = false,
  onKonfirmasi,
}: Props) {
  return (
    <Dialog open={buka} onOpenChange={onBukaBerubah}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription>{pesan}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onBukaBerubah(false)}>
            Batal
          </Button>
          <Button variant="destructive" onClick={onKonfirmasi} disabled={sibuk}>
            {sibuk ? <Loader2 className="animate-spin" /> : null}
            {labelKonfirmasi}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
