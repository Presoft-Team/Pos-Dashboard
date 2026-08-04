'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

export interface ComboboxOption {
  id: string
  name: string
}

interface Props {
  value: string          // selected option's id, '' = none ("All X")
  options: ComboboxOption[]
  placeholder: string    // e.g. "All Branches"
  onChange: (value: string) => void
  ariaLabel: string
}

// Click it → full list, same as a plain <select>. Type → live-filters the
// list by name. Click/Enter an option (or the "All X" row) to choose it.
// Replaces the FilterBar's plain <select> fields so "select or type" is a
// real search, not just the browser's default select-jumps-on-keypress.
export default function Combobox({ value, options, placeholder, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.id === value)

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

  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  function openList() {
    setOpen(true)
    setQuery('')
    setHighlight(0)
  }

  function choose(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); openList() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlight === 0) choose('')
      else if (filtered[highlight - 1]) choose(filtered[highlight - 1].id)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
    }
  }

  const displayValue = open ? query : (selected?.name ?? '')

  return (
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        value={displayValue}
        placeholder={placeholder}
        onFocus={openList}
        onClick={openList}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0) }}
        onKeyDown={onKeyDown}
        className="h-9 min-w-0 w-full sm:w-auto pl-3 pr-16 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent placeholder:text-gray-700"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); choose('') }}
            className="text-gray-400 hover:text-gray-600"
            aria-label={`Clear ${ariaLabel}`}
          >
            <X size={13} />
          </button>
        )}
        <ChevronDown size={14} className="text-gray-400 pointer-events-none" />
      </div>

      {open && (
        <ul className="absolute z-20 mt-1 w-full min-w-[10rem] max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm">
          <li
            onMouseDown={(e) => { e.preventDefault(); choose('') }}
            className={`px-3 py-1.5 cursor-pointer ${highlight === 0 ? 'bg-brand/10 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {placeholder}
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-1.5 text-gray-400">No matches</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.id}
                onMouseDown={(e) => { e.preventDefault(); choose(o.id) }}
                className={`px-3 py-1.5 cursor-pointer truncate ${
                  highlight === i + 1 ? 'bg-brand/10 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {o.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
