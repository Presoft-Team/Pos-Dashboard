'use client'

import { useState } from 'react'
import { Filters, FilterOptions } from '@/types'

export interface DatePreset {
  key: string
  label: string
  months?: number
  days?: number
}

// Sales Dashboard & Performance — short-range glancing presets.
export const DASHBOARD_PRESETS: DatePreset[] = [
  { key: '30d', label: '30 Days', days: 30 },
  { key: '4m', label: '4 Months', months: 4 },
  { key: '6m', label: '6 Months', months: 6 },
  { key: '12m', label: '12 Months', months: 12 },
]

// Monthly Sales — trend page, longer ranges only. Shares the '6m'/'12m'
// keys with DASHBOARD_PRESETS on purpose — same key, same computed range,
// so a page-reconciliation check (see MonthlyPage) can tell "this shared
// date range is one Monthly can also represent" from "it's a Dashboard-only
// preset (30 Days / 4 Months) that Monthly has no button for."
export const MONTHLY_PRESETS: DatePreset[] = [
  { key: '6m', label: '6 Months', months: 6 },
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

// Initial filter state for a page using this component — first preset in
// the given list (or Dashboard's set by default).
export function defaultDateRange(presets: DatePreset[] = DASHBOARD_PRESETS) {
  return computeRange(presets[0])
}

interface Props {
  filters: Filters
  options: FilterOptions
  onChange: (f: Filters) => void
  // Which relative-range buttons to show — defaults to the Dashboard's set.
  presets?: DatePreset[]
}

// Replaces the shared FilterBar's free from/to pickers on pages that opt in
// (via FilterBar's `datePicker` prop) with a small set of relative-range
// buttons, plus a "Custom" option that falls back to those same pickers for
// anyone who needs an exact range. Which button is highlighted is derived
// straight from `filters.date_from`/`date_to` (not locally tracked click
// state) — so it stays correct even when the date range changes from
// elsewhere (e.g. navigating in from another page's shared filter state).
export default function DatePresetFilter({ filters, options, onChange, presets = DASHBOARD_PRESETS }: Props) {
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

  // Mobile: every preset button + Custom evenly fills one 100%-wide row
  // (grid-colsN, not the inline-flex wrap that let labels ladder onto a
  // ragged second line). Desktop: the toggle group is a *fixed* share of
  // the row instead — 40% for the 5-button Dashboard/Performance set, 30%
  // for Monthly's 3-button set — with the rest of the row either left
  // blank (no Custom active) or split into two 30%-wide date inputs
  // (Custom active); Monthly's 30/30/30 deliberately leaves 10% unused
  // rather than stretching to fill it. Only 2 configurations exist in this
  // app, so these are just literal Tailwind classes picked by a ternary,
  // not computed — arbitrary-value classes have to appear as complete
  // strings in source for Tailwind to find them.
  const buttonCount = presets.length + 1
  const isWideSet = buttonCount === 5 // Dashboard/Performance vs Monthly
  const mobileGridColsClass = isWideSet ? 'grid-cols-5' : buttonCount === 3 ? 'grid-cols-3' : 'grid-cols-2'
  const desktopRowColsClass = isWideSet
    ? (showCustom ? 'sm:grid-cols-[4fr_3fr_3fr]' : 'sm:grid-cols-[4fr_6fr]')
    : (showCustom ? 'sm:grid-cols-[3fr_3fr_3fr_1fr]' : 'sm:grid-cols-[3fr_7fr]')

  return (
    <div className={`flex flex-col sm:grid ${desktopRowColsClass} gap-2 sm:items-center w-full`}>
      <div className={`grid ${mobileGridColsClass} sm:flex sm:flex-wrap rounded-lg border border-gray-200 bg-white p-0.5 gap-0.5 w-full`}>
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => selectPreset(p)}
            className={`min-w-0 overflow-hidden text-ellipsis px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap sm:flex-1 ${
              !forceCustom && active?.key === p.key ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setForceCustom(true)}
          className={`min-w-0 overflow-hidden text-ellipsis px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap sm:flex-1 ${
            showCustom ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom ? (
        // sm:contents on mobile keeps this as one flex row (from – to);
        // on desktop it "disappears" so the two inputs become their own
        // direct grid items instead of being squeezed into a single cell.
        // The dash is sm:hidden — display:none removes it from grid flow
        // entirely, so it doesn't eat a column on desktop.
        <div className="flex items-center gap-2 w-full sm:contents">
          <input
            type="date" value={filters.date_from} onChange={(e) => onChange({ ...filters, date_from: e.target.value })}
            min={options.date_min ?? undefined} max={options.date_max ?? undefined}
            className={dateClass} aria-label="From date"
          />
          <span className="text-gray-400 text-sm shrink-0 sm:hidden">–</span>
          <input
            type="date" value={filters.date_to} onChange={(e) => onChange({ ...filters, date_to: e.target.value })}
            min={options.date_min ?? undefined} max={options.date_max ?? undefined}
            className={dateClass} aria-label="To date"
          />
        </div>
      ) : (
        // Desktop-only blank filler so the toggle group's fixed share
        // (40%/30%) actually leaves visible empty space instead of
        // stretching — mobile doesn't need it (flex-col just stacks).
        <div className="hidden sm:block" />
      )}
      {/* Monthly's 4th grid column (the deliberately-unused 10%) */}
      {showCustom && !isWideSet && <div className="hidden sm:block" />}
    </div>
  )
}
