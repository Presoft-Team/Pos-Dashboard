'use client'

import { useState } from 'react'
import { Filters, FilterOptions } from '@/types'

export interface DatePreset {
  key: string
  label: string
  months?: number
  days?: number
}

// One set for every page. There used to be two — a wider Dashboard set
// including 30 Days and 4 Months, and a longer-range Monthly set — which is
// why pages passed their own list and Monthly reconciled ranges it couldn't
// represent. With those two presets gone the sets are identical, so there is
// one list and nothing to reconcile.
export const DATE_PRESETS: DatePreset[] = [
  // Exactly 30 days back from today, not calendar-month arithmetic — a
  // fixed window rather than one that swings between 28 and 31 days
  // depending on which month it lands in.
  { key: '30d', label: '30 Days', days: 30 },
  { key: '3m', label: '3 Months', months: 3 },
  { key: '6m', label: '6 Months', months: 6 },
  { key: '9m', label: '9 Months', months: 9 },
  { key: '12m', label: '12 Months', months: 12 },
]

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function computeRange(preset: DatePreset) {
  const to = new Date()
  const from = new Date()
  if (preset.days) from.setDate(from.getDate() - preset.days)
  if (preset.months) from.setMonth(from.getMonth() - preset.months)
  return { date_from: toISODate(from), date_to: toISODate(to) }
}

// Does this preset's computed range equal the filters' current date range?
// Recomputed live against "today" rather than cached, so it stays correct
// no matter when/where it's checked.
export function matchesPreset(filters: Pick<Filters, 'date_from' | 'date_to'>, preset: DatePreset): boolean {
  const range = computeRange(preset)
  return filters.date_from === range.date_from && filters.date_to === range.date_to
}

// First preset (if any) in the list whose computed range matches the
// current filters — undefined means "custom" (or nothing set yet).
export function findMatchingPreset(filters: Pick<Filters, 'date_from' | 'date_to'>, presets: DatePreset[]): DatePreset | undefined {
  return presets.find((p) => matchesPreset(filters, p))
}

// Initial filter state for a page using this component — the first preset.
export function defaultDateRange(presets: DatePreset[] = DATE_PRESETS) {
  return computeRange(presets[0])
}

interface Props {
  filters: Filters
  options: FilterOptions
  onChange: (f: Filters) => void
  // Which relative-range buttons to show. Every page uses the default now;
  // the prop stays so a page can narrow the set without a component change.
  presets?: DatePreset[]
}

// Replaces the shared FilterBar's free from/to pickers on pages that opt in
// (via FilterBar's `datePicker` prop) with a small set of relative-range
// buttons, plus a "Custom" option that falls back to those same pickers for
// anyone who needs an exact range. Which button is highlighted is derived
// straight from `filters.date_from`/`date_to` (not locally tracked click
// state) — so it stays correct even when the date range changes from
// elsewhere (e.g. navigating in from another page's shared filter state).
export default function DatePresetFilter({ filters, options, onChange, presets = DATE_PRESETS }: Props) {
  // Only needed so clicking "Custom" keeps the pickers open even if the
  // dates you're about to edit still happen to match a preset — the
  // moment you actually change either date it stops mattering, since the
  // derived match below will already read "custom" on its own.
  const [forceCustom, setForceCustom] = useState(false)

  const active = findMatchingPreset(filters, presets)
  const showCustom = !active || forceCustom

  function selectPreset(p: DatePreset) {
    setForceCustom(false)
    onChange({ ...filters, ...computeRange(p) })
  }

  const dateClass =
    'h-9 min-w-0 w-full pl-3 pr-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent'

  // The parent (FilterBar) already gives this its own full-width row, so
  // the toggle group sizes to its own content rather than to a fixed share
  // of a grid — that share was tuned for 3 buttons and can't hold 6.
  //
  // Mobile: 3 per row, so "12 Months" still fits at 360px — six across would
  // truncate every label. Desktop: one row at natural width, with the date
  // inputs beside it when Custom is active.
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
      <div className="grid grid-cols-3 sm:flex rounded-lg border border-gray-200 bg-white p-0.5 gap-0.5 w-full sm:w-auto shrink-0">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => selectPreset(p)}
            className={`min-w-0 overflow-hidden text-ellipsis px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              !forceCustom && active?.key === p.key ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setForceCustom(true)}
          className={`min-w-0 overflow-hidden text-ellipsis px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            showCustom ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        // Capped on desktop so the two inputs stay input-sized instead of
        // stretching across whatever width the buttons leave over.
        <div className="flex items-center gap-2 w-full sm:max-w-md">
          <input
            type="date" value={filters.date_from} onChange={(e) => onChange({ ...filters, date_from: e.target.value })}
            min={options.date_min ?? undefined} max={options.date_max ?? undefined}
            className={dateClass} aria-label="From date"
          />
          <span className="text-gray-400 text-sm shrink-0">–</span>
          <input
            type="date" value={filters.date_to} onChange={(e) => onChange({ ...filters, date_to: e.target.value })}
            min={options.date_min ?? undefined} max={options.date_max ?? undefined}
            className={dateClass} aria-label="To date"
          />
        </div>
      )}
    </div>
  )
}
