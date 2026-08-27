'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Truck,
  Tag,
  X,
} from 'lucide-react'

const NAV = [
  { href: '/',            label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/monthly',     label: 'Monthly',     icon: CalendarDays },
  { href: '/performance', label: 'Performance', icon: BarChart3 },
  { href: '/purchase',    label: 'Purchase',    icon: Truck },
  { href: '/item',        label: 'Item',        icon: Tag },
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

        {/* Close button — mobile only. There's no account block to sit
            alongside anymore (no login), but the drawer still needs a way
            to dismiss itself on small screens; desktop renders no bar at
            all rather than an empty one. */}
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
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
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
