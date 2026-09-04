'use client'

import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import DetailOverlay from '@/components/detail-overlay'
import SalesFilterFields, {
  salesFilterActiveCount, SalesFilterKey, SalesFilterOptions, SalesFilterState,
} from '@/components/sales-filter-fields'

export type { SalesFilterKey, SalesFilterOptions, SalesFilterState }
export { EMPTY_SALES_FILTER_OPTIONS } from '@/components/sales-filter-fields'

interface Props {
  value: SalesFilterState
  onChange: (next: SalesFilterState) => void
  options: SalesFilterOptions
  exclude?: SalesFilterKey
  unattributed?: {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
  }[]
}

// Trigger + overlay for SalesFilterFields — used standalone by the Sales by
// Agent/Area/Location pages. The Sales page instead folds this same field
// grid into SalesAnalysisPanel's Filter tab, alongside Columns and Options.
export default function SalesFilterPanel({ value, onChange, options, exclude, unattributed }: Props) {
  const [open, setOpen] = useState(false)
  const activeCount = salesFilterActiveCount(value, exclude)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors whitespace-nowrap"
      >
        <SlidersHorizontal size={15} />
        Filters
        {activeCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-brand text-white text-[11px] leading-none">
            {activeCount}
          </span>
        )}
      </button>

      {/* A full-screen focus page rather than a popover — thirteen
          multi-selects don't fit a dropdown, and each one opens a list of
          its own that would have to escape the popover's bounds. Changes
          apply live behind it; X (or Escape) returns to the page. */}
      <DetailOverlay
        open={open}
        onClose={() => setOpen(false)}
        title="Filters"
        subtitle={activeCount === 0 ? 'No filters applied' : `${activeCount} filter${activeCount === 1 ? '' : 's'} applied`}
      >
        {activeCount > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onChange({})}
              className="text-sm font-medium text-brand hover:text-brand/80"
            >
              Clear all
            </button>
          </div>
        )}
        <SalesFilterFields value={value} onChange={onChange} options={options} exclude={exclude} unattributed={unattributed} />
      </DetailOverlay>
    </>
  )
}
