'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarDays,
  BarChart3,
  Tag,
  UserRound,
  MapPin,
  Building2,
  X,
} from 'lucide-react'

const NAV = [
  // Monthly is the landing page now — the old Sales Dashboard at '/' was
  // removed, its KPI tiles moved to the Sales page, and its Revenue-by-Item
  // chart/table dropped as duplicates of Sales' own Item breakdown.
  { href: '/',              label: 'Monthly',     icon: CalendarDays },
  { href: '/sales',         label: 'Sales',       icon: BarChart3 },
  // The three Sales sub-pages.
  { href: '/sales/agent',    label: 'Sales by Agent',    icon: UserRound },
  { href: '/sales/area',     label: 'Sales by Area',     icon: MapPin },
  { href: '/sales/location', label: 'Sales by Location', icon: Building2 },
  // Master-data browsers, grouped after the reporting pages.
  { href: '/item',          label: 'Item',        icon: Tag },
]

interface Props {
  mobileOpen: boolean
  onClose: () => void
}

export default function Sidebar({ mobileOpen, onClose }: Props) {
  const pathname = usePathname()

  return (
    <>
      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-60 bg-paper border-r border-ink/10 transform transition-transform duration-200 ease-out lg:static lg:translate-x-0 lg:z-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Branding — desktop only; mobile gets its own top bar in dashboard-shell.tsx */}
        <Link href="/" onClick={onClose} className="hidden lg:flex flex-col items-start gap-0 px-6 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/presoft.png" alt="Presoft" className="h-12 w-auto" />
          <p className="text-brand font-bold text-base tracking-wide -mt-1">Dashboard Platform</p>
        </Link>
        <div className="hidden lg:block mx-5 border-t border-ink/10" />

        {/* Mobile close — this row used to also show the signed-in account,
            which went away with login; the drawer still needs its dismiss
            control, so the row survives as mobile-only. */}
        <div className="flex items-center justify-end px-6 py-2.5 border-b border-ink/10 lg:hidden">
          <button
            onClick={onClose}
            className="p-1 text-sand hover:text-ink"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            // Exact match only — Sales has its own child route
            // ('/sales/agent') with its own nav entry, so a prefix match
            // would light up both rows at once while on it.
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand text-ink'
                    : 'text-sand hover:text-ink hover:bg-ink/5'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
