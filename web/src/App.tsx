import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppSidebar } from '@/components/app-sidebar'
import { Toaster } from '@/components/ui/sonner'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PenyediaTahun } from '@/lib/tahun'
import { PenyediaTema } from '@/lib/theme'
import HalamanPendapatan from '@/pages/pendapatan'
import HalamanPengaturan from '@/pages/pengaturan'
import HalamanRingkasan from '@/pages/ringkasan'
import HalamanSetoran from '@/pages/setoran'
import HalamanSpt from '@/pages/spt'

// Vite memberi BASE_URL "/app/" untuk build produksi, "/" saat dev.
// React Router mau basename tanpa garis miring di akhir.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

export default function App() {
  return (
    <PenyediaTema>
      <TooltipProvider delayDuration={200}>
        <BrowserRouter basename={basename}>
          <PenyediaTahun>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                  <Routes>
                    <Route path="/" element={<HalamanRingkasan />} />
                    <Route path="/pendapatan" element={<HalamanPendapatan />} />
                    <Route path="/setoran" element={<HalamanSetoran />} />
                    <Route path="/spt" element={<HalamanSpt />} />
                    <Route path="/pengaturan" element={<HalamanPengaturan />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </div>
              </SidebarInset>
              <Toaster position="top-right" closeButton />
            </SidebarProvider>
          </PenyediaTahun>
        </BrowserRouter>
      </TooltipProvider>
    </PenyediaTema>
  )
}
