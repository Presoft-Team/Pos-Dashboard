'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  open: boolean
  onClose: () => void
  onOpenSettings: () => void
}

// react-router-dom's <Link to>/<NavLink> replaced by next/link + the
// usePathname() hook, which is how "which entry is current" is decided
// here rather than by a prop from the page.
const LINKS = [
  {
    href: '/v2',
    label: 'Dashboard',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9"></rect>
        <rect x="14" y="3" width="7" height="5"></rect>
        <rect x="14" y="12" width="7" height="9"></rect>
        <rect x="3" y="16" width="7" height="5"></rect>
      </>
    ),
  },
  {
    href: '/v2/items',
    label: 'Items',
    icon: (
      <>
        <path d="M21 8l-9-5-9 5 9 5 9-5z"></path>
        <path d="M3 8v8l9 5 9-5V8"></path>
        <path d="M12 13v8"></path>
      </>
    ),
  },
]

export default function SideDrawer({ open, onClose, onOpenSettings }: Props) {
  const pathname = usePathname()

  return (
    <>
      <div
        hidden={!open}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs z-[99]"
      />
      <aside
        aria-hidden={!open}
        aria-label="Navigation Menu"
        className={
          'fixed top-0 left-0 bottom-0 w-[275px] max-w-[82vw] bg-card z-[100] shadow-[4px_0_28px_rgba(15,23,42,0.16)] flex flex-col transition-transform duration-300 ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white font-bold text-[13px] flex items-center justify-center">
              P
            </div>
            <span className="text-[14.5px] font-bold text-ink">Menu</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-[30px] h-[30px] rounded-lg border-none bg-transparent text-sand text-xl leading-none flex items-center justify-center hover:bg-paper hover:text-ink"
          >
            &times;
          </button>
        </div>

        <nav className="p-2.5 flex flex-col gap-1.5 flex-1">
          {LINKS.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] font-semibold text-[13.5px] w-full text-left border ' +
                  (active
                    ? 'border-blue-200 bg-blue-bg text-blue'
                    : 'border-transparent text-ink hover:bg-paper')
                }
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {link.icon}
                </svg>
                <span>{link.label}</span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border border-transparent text-ink font-semibold text-[13.5px] w-full text-left hover:bg-paper"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Settings</span>
            <span className="ml-auto text-[10px] font-bold text-blue bg-card border border-blue-200 px-1.5 py-0.5 rounded-full">
              Preferences
            </span>
          </button>

          <div className="mt-auto pt-2 border-t border-border flex flex-col gap-1.5">
            {/* Back to the eight production pages — /v2 is an alternative
                UI over the same data, not a replacement, so the drawer has
                to lead out of it as well as around it. */}
            <Link
              href="/monthly"
              onClick={onClose}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border border-transparent text-ink font-semibold text-[13.5px] w-full text-left hover:bg-paper"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <span>Classic dashboard</span>
            </Link>
            <a
              href="/api/auth/logout"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border border-transparent text-sand font-semibold text-[13.5px] w-full text-left hover:bg-paper hover:text-ink"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Log out</span>
            </a>
          </div>
        </nav>
      </aside>
    </>
  )
}
