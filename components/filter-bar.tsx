'use client'

import type { ReactNode } from 'react'
import { FilterOptions, Filters, GroupByMode } from '@/types'
import Combobox from '@/components/combobox'
import GroupByToggle from '@/components/group-by-toggle'

interface Props {
  filters: Filters
  options: FilterOptions
  onChange: (f: Filters) => void
  // Which of Item/Group/Type is active — decides whether the one dynamic
  // combobox filters by item, item group, or item type. Pages without a
  // Group By toggle (e.g. Monthly) can omit this; it defaults to 'item'.
  groupBy?: GroupByMode
  // Renders the Item/Group/Type toggle immediately to the left of the
  // dynamic combobox (toggle → filter, reading left to right) when
  // provided. Omit on pages with no Group By concept.
  onGroupByChange?: (mode: GroupByMode) => void
  // Each element is one "slot" (e.g. the Export button). Joins the same
  // grid as the entity fields on both breakpoints — mobile 2-per-row,
  // desktop 5-per-row. A slot that renders nothing (e.g. a hidden
  // CurrencyFilter) must be left out of this array entirely by the
  // caller, not included-but-hidden — an empty grid cell still occupies a
  // track and leaves a real gap instead of letting the next slot (Export)
  // fill it.
  trailing?: ReactNode[]
  // Overrides the default from/to date pickers (e.g. Sales Dashboard's
  // preset selector) when provided. Other pages keep the plain pickers.
  datePicker?: ReactNode
}

// Global FilterBar (PLAN.md Section 3) — shared by Sales Dashboard, Monthly
// Sales, Performance, and Item pages. Date range + 4 entity fields (Location,
// Item, Sales Agent, Debtor) + Item Group/Item Type. Every field
// except date range is a Combobox — click for the full list (same as a
// plain <select>), or type to live-filter it by name. An entity field with
// an empty option list (nothing to filter by) hides itself entirely — see
// `entityFields` below.
//
// Two separate layouts, not one responsive one: mobile puts every entity
// field + trailing slot into a fixed 2-column grid below the date row;
// desktop puts the same flat list into a fixed 5-column (20% each) grid
// below its own date row — toggle and its dynamic combobox are separate
// cells on both breakpoints (a shared cell was tried but too cramped once
// desktop went to 5 columns). Comboboxes pass `fullWidth` so they actually
// fill their grid cell on desktop — Combobox's default `sm:w-auto` sizes
// its <input> to the browser's intrinsic text-input width, not its
// container, because `width:auto` on a replaced/form element doesn't
// "fill" the way it does on a plain <div> (only mobile's plain `w-full` —
// an explicit 100%, not
// auto — works without this).
export default function FilterBar({ filters, options, onChange, groupBy = 'item', onGroupByChange, trailing = [], datePicker }: Props) {
  function set(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value })
  }

  const dateClass =
    'h-9 min-w-0 w-full sm:w-auto pl-3 pr-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent'

  const dateFrom = (
    <input
      type="date" value={filters.date_from} onChange={(e) => set('date_from', e.target.value)}
      min={options.date_min ?? undefined} max={options.date_max ?? undefined}
      className={dateClass} aria-label="From date"
    />
  )
  const dateTo = (
    <input
      type="date" value={filters.date_to} onChange={(e) => set('date_to', e.target.value)}
      min={options.date_min ?? undefined} max={options.date_max ?? undefined}
      className={dateClass} aria-label="To date"
    />
  )
  const hasLocation = options.locations.length > 0
  const location = (
    <Combobox value={filters.location} onChange={(v) => set('location', v)} options={options.locations} placeholder="All Locations" ariaLabel="Location" fullWidth />
  )
  // One slot whose meaning follows the active Group By mode — Item, Item
  // Group, or Item Type — instead of showing all three at once. Hidden
  // when the currently active list has nothing to filter by.
  const hasItemDynamic =
    (groupBy === 'group' ? options.item_groups.length : groupBy === 'type' ? options.item_types.length : options.items.length) > 0
  const itemDynamic =
    groupBy === 'group' ? (
      <Combobox
        value={filters.item_group}
        onChange={(v) => set('item_group', v)}
        options={options.item_groups.map((g) => ({ id: g, name: g }))}
        placeholder="All Item Groups"
        ariaLabel="Item Group"
        fullWidth
      />
    ) : groupBy === 'type' ? (
      <Combobox
        value={filters.item_type}
        onChange={(v) => set('item_type', v)}
        options={options.item_types.map((t) => ({ id: t, name: t }))}
        placeholder="All Item Types"
        ariaLabel="Item Type"
        fullWidth
      />
    ) : (
      <Combobox value={filters.item} onChange={(v) => set('item', v)} options={options.items} placeholder="All Items" ariaLabel="Item" fullWidth />
    )
  // Sits immediately left of itemDynamic wherever it renders — toggle,
  // then the field it controls, reading left to right. Always shown when
  // provided — it also drives which grouping the chart/table use, not just
  // this field, so it stays even if the active list happens to be empty.
  const toggle = onGroupByChange ? <GroupByToggle value={groupBy} onChange={onGroupByChange} /> : null
  const hasSalesAgent = options.sales_agents.length > 0
  const salesAgent = (
    <Combobox value={filters.sales_agent} onChange={(v) => set('sales_agent', v)} options={options.sales_agents} placeholder="All Sales Agents" ariaLabel="Sales Agent" fullWidth />
  )
  const hasDebtor = options.debtors.length > 0
  const debtor = (
    <Combobox value={filters.debtor} onChange={(v) => set('debtor', v)} options={options.debtors} placeholder="All Debtors" ariaLabel="Debtor" fullWidth />
  )

  // Mobile — entity fields with nothing to filter by hide themselves;
  // Same flat list on both breakpoints — toggle and the dynamic Item/Group/
  // Type field are separate cells (a shared cell was too cramped once the
  // desktop grid went to 5 columns/20% each; at that width each field
  // needs its own cell, same as Location/Sales Agent/Debtor).
  const entityFields: { key: string; node: ReactNode }[] = [
    ...(hasLocation ? [{ key: 'location', node: location }] : []),
    ...(toggle ? [{ key: 'toggle', node: toggle }] : []),
    ...(hasItemDynamic ? [{ key: 'item', node: itemDynamic }] : []),
    ...(hasSalesAgent ? [{ key: 'salesAgent', node: salesAgent }] : []),
    ...(hasDebtor ? [{ key: 'debtor', node: debtor }] : []),
  ]

  return (
    <>
      {/* Mobile — date filter gets its own full-width row (100%); every
          other field is a fixed 2-column (50/50) grid. */}
      <div className="sm:hidden w-full space-y-2">
        <div className="w-full">
          {datePicker ?? (
            <div className="flex items-center gap-2">
              {dateFrom}
              <span className="text-gray-400 text-sm shrink-0">–</span>
              {dateTo}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {entityFields.map((f) => <div key={f.key} className="min-w-0">{f.node}</div>)}
          {trailing.map((node, i) => <div key={`trailing-${i}`} className="min-w-0">{node}</div>)}
        </div>
      </div>

      {/* Desktop — date filter its own full-width row (DatePresetFilter
          splits that row itself: fixed-share toggle group + blank space or
          custom inputs); every other field is a fixed 5-column (20% each)
          grid — up to 5 per row — Export always last so it fills a
          leftover slot instead of landing alone in its own row. */}
      <div className="hidden sm:flex sm:flex-col sm:gap-2 sm:w-full">
        <div className="w-full">
          {datePicker ?? (
            <div className="flex items-center gap-2">
              {dateFrom}
              <span className="text-gray-400 text-sm">–</span>
              {dateTo}
            </div>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {entityFields.map((f) => <div key={f.key} className="min-w-0">{f.node}</div>)}
          {trailing.map((node, i) => <div key={`trailing-${i}`} className="min-w-0">{node}</div>)}
        </div>
      </div>
    </>
  )
}
