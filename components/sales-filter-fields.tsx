'use client'

import { EntityOption } from '@/types'
import MultiCombobox from '@/components/multi-combobox'
import UnattributedToggle from '@/components/unattributed-toggle'

// Every field the sales filter set can offer. Shared by SalesFilterPanel
// (its own "Filters" overlay, used by the Sales by Agent/Area/Location
// pages) and SalesAnalysisPanel (the Filter tab of the Multi Dimension
// Sales Analysis overlay on the Sales page) — one field list, one grid
// renderer, instead of two copies drifting apart.
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

export const SALES_FILTER_FIELDS: { key: SalesFilterKey; label: string; from: keyof SalesFilterOptions }[] = [
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

export function salesFilterActiveCount(value: SalesFilterState, exclude?: SalesFilterKey): number {
  const fields = exclude ? SALES_FILTER_FIELDS.filter((f) => f.key !== exclude) : SALES_FILTER_FIELDS
  return fields.reduce((n, f) => n + ((value[f.key]?.length ?? 0) > 0 ? 1 : 0), 0)
}

interface Props {
  value: SalesFilterState
  onChange: (next: SalesFilterState) => void
  options: SalesFilterOptions
  // The page's primary dimension, already filtered outside the panel.
  // Omitted on pages with no outside dimension filter (e.g. Sales), where
  // every field lives inside the panel instead.
  exclude?: SalesFilterKey
  // Show/hide-unattributed-bucket controls. One entry per distinct bucket a
  // page can have, toggled independently — omitted on pages with none.
  unattributed?: {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
  }[]
}

// Every field shows, even when its master table is empty in this account
// book — an absent control reads as "this dashboard can't filter by Item
// Type", when the truth is "no item types are set up yet". The only field
// left out is the page's own dimension (if any), which is already filtered
// by the control outside this panel.
export default function SalesFilterFields({ value, onChange, options, exclude, unattributed }: Props) {
  const fields = exclude ? SALES_FILTER_FIELDS.filter((f) => f.key !== exclude) : SALES_FILTER_FIELDS

  function setField(key: SalesFilterKey, next: string[]) {
    onChange({ ...value, [key]: next })
  }

  return (
    <>
      {unattributed && unattributed.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 space-y-2">
          {unattributed.map((u) => (
            <UnattributedToggle key={u.label} checked={u.checked} onChange={u.onChange} label={u.label} />
          ))}
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
    </>
  )
}
