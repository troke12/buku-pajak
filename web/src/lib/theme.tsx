import { ThemeProvider as PenyediaTemaNext, useTheme } from 'next-themes'

/** Pembungkus tema (light/dark) memakai next-themes supaya nyambung dengan Toaster. */
export function PenyediaTema({ children }: { children: React.ReactNode }) {
  return (
    <PenyediaTemaNext attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </PenyediaTemaNext>
  )
}

export function useTema() {
  const { resolvedTheme, setTheme } = useTheme()
  const gelap = resolvedTheme === 'dark'
  return {
    tema: gelap ? ('gelap' as const) : ('terang' as const),
    ganti: () => setTheme(gelap ? 'light' : 'dark'),
  }
}
