'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

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

// Small custom dropdown for a fixed set of sort options — same visual
// language as Combobox (rounded pill, chevron, brand-highlighted selected
// row) but without a search input or "All" clear state, since sort always
// has exactly one active value. Replaces a plain <select>, whose native
// option-list styling (especially on mobile) doesn't match the rest of the
// app and whose width collapses awkwardly in a flex row on desktop.
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
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="h-9 w-full flex items-center justify-between gap-2 pl-3 pr-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
      >
        <span className="truncate">{selected?.label ?? ariaLabel}</span>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm"
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
