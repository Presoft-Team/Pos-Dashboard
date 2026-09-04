'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpDown, Check } from 'lucide-react'

export interface SortOption {
  value: string
  label: string
}

interface Props {
  value: string
  options: readonly SortOption[]
  onChange: (value: string) => void
  ariaLabel?: string
}

// Icon-only trigger for a fixed set of sort options — pressing it opens a
// dropdown to pick from, so the control stays a fixed 9x9 square instead of
// growing to fit whichever option label is selected. Same brand-highlighted
// selected row as Combobox, but no search input or "All" clear state, since
// sort always has exactly one active value.
export default function SortSelect({ value, options, onChange, ariaLabel = 'Sort by' }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={selected ? `${ariaLabel}: ${selected.label}` : ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
      >
        <ArrowUpDown size={15} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 right-0 mt-1 min-w-max max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm"
        >
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false) }}
              className={`px-3 py-1.5 cursor-pointer flex items-center justify-between gap-2 ${
                o.value === value ? 'bg-brand/10 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check size={14} className="text-brand shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
