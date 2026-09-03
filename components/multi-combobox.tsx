'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { EntityOption } from '@/types'

interface Props {
  // Selected ids. Empty means "no filter", never "match nothing".
  value: string[]
  options: EntityOption[]
  placeholder: string
  onChange: (value: string[]) => void
  ariaLabel: string
}

// Multi-select twin of Combobox: type to narrow the list, click to toggle
// each option on or off, and the list stays open so several can be picked in
// one go. Combobox itself closes on choose and holds a single id, which is
// right for "show me this one thing" and wrong for a filter that accumulates.
export default function MultiCombobox({ value, options, placeholder, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selected = new Set(value)
  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  // The closed-state label: one name reads better than "1 selected", but
  // beyond that the names don't fit and a count is more useful anyway.
  const label =
    value.length === 0
      ? ''
      : value.length === 1
        ? options.find((o) => o.id === value[0])?.name ?? value[0]
        : `${value.length} selected`

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        value={open ? query : label}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery('') }}
        onClick={() => { setOpen(true); setQuery('') }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
        className="h-9 min-w-0 w-full pl-3 pr-16 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent placeholder:text-gray-700"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {value.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange([]) }}
            className="text-gray-400 hover:text-gray-600"
            aria-label={`Clear ${ariaLabel}`}
          >
            <X size={13} />
          </button>
        )}
        <ChevronDown size={14} className="text-gray-400 pointer-events-none" />
      </div>

      {open && (
        <ul className="absolute z-30 mt-1 w-full min-w-[12rem] max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm">
          {filtered.length === 0 ? (
            // "No matches" would be wrong when the list is empty to begin
            // with — that's nothing set up, not a search that found nothing.
            <li className="px-3 py-1.5 text-gray-400">
              {options.length === 0 ? 'None set up in this account book' : 'No matches'}
            </li>
          ) : (
            filtered.map((o) => {
              const isOn = selected.has(o.id)
              return (
                <li
                  key={o.id}
                  // onMouseDown, not onClick: mousedown fires before the
                  // input's blur, so the list doesn't close underneath the
                  // pointer mid-click.
                  onMouseDown={(e) => { e.preventDefault(); toggle(o.id) }}
                  className={`px-3 py-1.5 cursor-pointer flex items-center justify-between gap-2 ${
                    isOn ? 'bg-brand/10 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate">{o.name}</span>
                  {isOn && <Check size={14} className="text-brand shrink-0" />}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
