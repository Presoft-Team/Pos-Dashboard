'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

// Every open overlay, innermost last. Escape must close only the topmost —
// both listen on window, so without this a single press would close a
// document and the entity it was opened from at the same time.
const openStack: symbol[] = []

interface Props {
  open: boolean
  onClose: () => void
  title: string
  // Small line under the title — a code, a type, a date range.
  subtitle?: string
  // Stacking level. A document opened from inside an entity's history sits
  // above that entity's overlay, so closing it returns to the entity rather
  // than all the way out to the page.
  layer?: 'base' | 'above'
  children: React.ReactNode
}

// A block that covers the entire screen, sidebar included — it reads as its
// own page but is not a route: no URL, no sidebar entry, nothing to navigate
// back from except the X (or Escape).
//
// Deliberately not the existing <Modal>: that's a centered dialog with a
// visible backdrop and a max width, for short-lived confirmations. This is a
// full takeover holding a whole entity's record and its document history.
export default function DetailOverlay({ open, onClose, title, subtitle, layer = 'base', children }: Props) {
  const idRef = useRef<symbol>(Symbol('overlay'))

  useEffect(() => {
    if (!open) return
    const id = idRef.current
    openStack.push(id)

    function onKeyDown(e: KeyboardEvent) {
      // Only the topmost overlay reacts, so Escape peels one layer at a
      // time instead of collapsing the whole stack.
      if (e.key === 'Escape' && openStack[openStack.length - 1] === id) onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    // The page underneath must not scroll while this is up — otherwise
    // flicking past the end of the overlay's own scroll area drags the
    // dashboard behind it, and closing lands the user somewhere else.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      const at = openStack.lastIndexOf(id)
      if (at !== -1) openStack.splice(at, 1)
      // Only the last overlay to close restores scrolling — an inner one
      // unmounting must leave the page locked for the outer one still up.
      if (openStack.length === 0) document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={`fixed inset-0 ${layer === 'above' ? 'z-[70]' : 'z-[60]'} bg-gray-50 flex flex-col`}>
      {/* Sticky header so the X stays reachable however far down the
          history the user has scrolled. */}
      <div className="shrink-0 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-2 -m-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">{children}</div>
      </div>
    </div>
  )
}
