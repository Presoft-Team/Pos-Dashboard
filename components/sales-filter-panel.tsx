'use client'

import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { EntityOption } from '@/types'
import MultiCombobox from '@/components/multi-combobox'
import DetailOverlay from '@/components/detail-overlay'

// Every field the panel can offer. The page's own dimension is excluded by
// the caller — filtering by agent inside the panel while an Agent filter
// already sits outside it would be two controls for one thing.
export type SalesFilterKey =
  | 'agent' | 'area' | 'location'
  | 'debtor' | 'debtor_type'
  | 'item' | 'item_group' | 'item_type' | 'item_brand' | 'item_class' | 'item_category'
  | 'project' | 'dept'

export type SalesFilterState = Partial<Record<SalesFilterKey, string[]>>

export interface SalesFilterOptions {
  agents: EntityOption[]
  areas: EntityOption[]
  locations: EntityOption[]
  debtors: EntityOption[]
  debtor_types: EntityOption[]
  items: EntityOption[]
  item_groups: EntityOption[]
  item_types: EntityOption[]
  item_brands: EntityOption[]
  item_classes: EntityOption[]
  item_categories: EntityOption[]
  projects: EntityOption[]
  depts: EntityOption[]
}

export const EMPTY_SALES_FILTER_OPTIONS: SalesFilterOptions = {
  agents: [], areas: [], locations: [], debtors: [], debtor_types: [], items: [],
  item_groups: [], item_types: [], item_brands: [], item_classes: [],
  item_categories: [], projects: [], depts: [],
}

const FIELDS: { key: SalesFilterKey; label: string; from: keyof SalesFilterOptions }[] = [
  { key: 'agent', label: 'Sales Agent', from: 'agents' },
  { key: 'area', label: 'Area', from: 'areas' },
  { key: 'location', label: 'Location', from: 'locations' },
  { key: 'debtor', label: 'Debtor Code', from: 'debtors' },
  { key: 'debtor_type', label: 'Debtor Type', from: 'debtor_types' },
  { key: 'item', label: 'Item Code', from: 'items' },
  { key: 'item_group', label: 'Item Group', from: 'item_groups' },
  { key: 'item_type', label: 'Item Type', from: 'item_types' },
  { key: 'item_brand', label: 'Item Brand', from: 'item_brands' },
  { key: 'item_class', label: 'Item Class', from: 'item_classes' },
  { key: 'item_category', label: 'Item Category', from: 'item_categories' },
  { key: 'project', label: 'Project No', from: 'projects' },
  { key: 'dept', label: 'Department No', from: 'depts' },
]

interface Props {
  value: SalesFilterState
  onChange: (next: SalesFilterState) => void
  options: SalesFilterOptions
  // The page's primary dimension, already filtered outside the panel.
  exclude: SalesFilterKey
}

export default function SalesFilterPanel({ value, onChange, options, exclude }: Props) {
  const [open, setOpen] = useState(false)

  // Every field shows, even when its master table is empty in this account
  // book — an absent control reads as "this dashboard can't filter by Item
  // Type", when the truth is "no item types are set up yet". The only field
  // left out is the page's own dimension, which is already filtered by the
  // control outside this panel.
  const fields = FIELDS.filter((f) => f.key !== exclude)

  const activeCount = fields.reduce((n, f) => n + ((value[f.key]?.length ?? 0) > 0 ? 1 : 0), 0)

  function setField(key: SalesFilterKey, next: string[]) {
    onChange({ ...value, [key]: next })
  }

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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1 min-w-0">
              <label className="text-xs font-medium text-gray-500">{f.label}</label>
              <MultiCombobox
                value={value[f.key] ?? []}
                options={options[f.from]}
                placeholder="No filter"
                onChange={(next) => setField(f.key, next)}
                ariaLabel={f.label}
              />
            </div>
          ))}
        </div>
      </DetailOverlay>
    </>
  )
}
