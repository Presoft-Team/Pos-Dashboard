'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/sidebar'

interface Props {
  children: React.ReactNode
  // Signed-in client's name (from the session cookie), or null when no
  // DB-based login is active for this deployment (no SESSION_SECRET set,
  // or no session yet) — the account row simply doesn't render then.
  clientName?: string | null
}

export default function DashboardShell({ children, clientName }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden">
      {/* Mobile top bar — brand identity, plus account/logout when signed in */}
      <header className="lg:hidden flex items-center justify-between px-4 py-2.5 bg-paper border-b border-ink/10 shrink-0">
        {/* /monthly, not / — / redirects to the v2 dashboard, and the logo
            inside the classic shell should stay inside it. */}
        <Link href="/monthly" className="flex flex-col items-start gap-0 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/presoft.png" alt="Presoft" className="h-6 w-auto shrink-0" />
          <p className="text-brand font-bold text-xs tracking-wide -mt-0.5 truncate">Dashboard Platform</p>
        </Link>
        <div className="flex items-center gap-3 shrink-0">
          {clientName && (
            <a href="/api/auth/logout" className="text-xs font-medium text-sand hover:text-ink">
              Log out
            </a>
          )}
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 text-ink hover:bg-ink/5 rounded-lg"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {clientName && (
          <div className="hidden lg:flex items-center justify-end gap-3 px-6 py-2 bg-paper border-b border-ink/10 shrink-0">
            <span className="text-sm text-sand">{clientName}</span>
            <a href="/api/auth/logout" className="text-sm font-medium text-ink hover:text-brand">
              Log out
            </a>
          </div>
        )}
        <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
      </div>
    </div>
  )
}
