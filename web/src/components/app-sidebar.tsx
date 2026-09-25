import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  LayoutDashboard,
  Moon,
  Settings,
  Sun,
  Wallet,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { usePengaturan } from '@/lib/query'
import { useTema } from '@/lib/theme'

const NAV = [
  { ke: '/', label: 'Ringkasan', ikon: LayoutDashboard },
  { ke: '/pendapatan', label: 'Pendapatan', ikon: ArrowDownToLine },
  { ke: '/setoran', label: 'Setoran pajak', ikon: ArrowUpFromLine },
  { ke: '/spt', label: 'SPT 1770', ikon: FileText },
  { ke: '/pengaturan', label: 'Pengaturan', ikon: Settings },
]

export function AppSidebar() {
  const { tema, ganti } = useTema()
  const { data: pengaturan } = usePengaturan()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                  <Wallet className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Buku Pajak</span>
                  <span className="text-muted-foreground truncate text-xs">
                    PPh pekerjaan bebas
                  </span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.ke}>
                  <SidebarMenuButton asChild tooltip={item.label}>
                    <NavLink
                      to={item.ke}
                      end={item.ke === '/'}
                      className={({ isActive }) => (isActive ? 'font-medium' : undefined)}
                    >
                      <item.ikon />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={ganti} tooltip="Ganti tema">
              {tema === 'gelap' ? <Sun /> : <Moon />}
              <span>{tema === 'gelap' ? 'Tema terang' : 'Tema gelap'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {pengaturan?.nama ? (
            <SidebarMenuItem>
              <div className="text-muted-foreground truncate px-2 py-1 text-xs group-data-[collapsible=icon]:hidden">
                {pengaturan.nama} · {pengaturan.status_ptkp}
                {pengaturan.mode_hitung === 'norma' ? ` · norma ${pengaturan.norma_persen}%` : ' · pembukuan'}
              </div>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
