'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/sidebar'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden">
      {/* Mobile top bar — brand identity only; account details live in the drawer */}
      <header className="lg:hidden flex items-center justify-between px-4 py-2.5 bg-paper border-b border-ink/10 shrink-0">
        <Link href="/" className="flex flex-col items-start gap-0 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/presoft.png" alt="Presoft" className="h-6 w-auto shrink-0" />
          <p className="text-brand font-bold text-xs tracking-wide -mt-0.5 truncate">Dashboard Platform</p>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 text-ink hover:bg-ink/5 rounded-lg shrink-0"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </header>

      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
    </div>
  )
}
