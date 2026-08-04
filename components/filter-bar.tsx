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
  // Each element is one "slot" (e.g. the Export button). On mobile they
  // share the last row with Creditor (or the Item/Group/Type field, if
  // there's no toggle), one slot per column; on desktop they render inline
  // after the filters, same place they used to sit as the page's own
  // siblings.
  trailing?: ReactNode[]
}

// Global FilterBar (PLAN.md Section 3) — shared by Sales Dashboard, Monthly
// Sales, Performance, and Item pages. Date range + 5 entity fields (Branch,
// Item, Sales Agent, Debtor, Creditor) + Item Group/Item Type. Every field
// except date range is a Combobox — click for the full list (same as a
// plain <select>), or type to live-filter it by name.
//
// Two separate layouts, not one responsive one: mobile groups fields into
// fixed-width rows (2 filters per row, 3 in the last with `trailing`) so
// every row lines up at a consistent width; desktop keeps a single
// natural-wrapping line. The two structures are different enough that
// forcing one grid to serve both breakpoints was messier than just
// rendering the fields twice. `w-full sm:w-auto` on each field is what lets
// the same element fill its mobile row slot but stay intrinsic-width on
// desktop.
export default function FilterBar({ filters, options, onChange, groupBy = 'item', onGroupByChange, trailing = [] }: Props) {
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
  const branch = (
    <Combobox value={filters.branch} onChange={(v) => set('branch', v)} options={options.branches} placeholder="All Branches" ariaLabel="Branch" />
  )
  // One slot whose meaning follows the active Group By mode — Item, Item
  // Group, or Item Type — instead of showing all three at once.
  const itemDynamic =
    groupBy === 'group' ? (
      <Combobox
        value={filters.item_group}
        onChange={(v) => set('item_group', v)}
        options={options.item_groups.map((g) => ({ id: g, name: g }))}
        placeholder="All Item Groups"
        ariaLabel="Item Group"
      />
    ) : groupBy === 'type' ? (
      <Combobox
        value={filters.item_type}
        onChange={(v) => set('item_type', v)}
        options={options.item_types.map((t) => ({ id: t, name: t }))}
        placeholder="All Item Types"
        ariaLabel="Item Type"
      />
    ) : (
      <Combobox value={filters.item} onChange={(v) => set('item', v)} options={options.items} placeholder="All Items" ariaLabel="Item" />
    )
  // Sits immediately left of itemDynamic wherever it renders — toggle,
  // then the field it controls, reading left to right.
  const toggle = onGroupByChange ? <GroupByToggle value={groupBy} onChange={onGroupByChange} /> : null
  const salesAgent = (
    <Combobox value={filters.sales_agent} onChange={(v) => set('sales_agent', v)} options={options.sales_agents} placeholder="All Sales Agents" ariaLabel="Sales Agent" />
  )
  const debtor = (
    <Combobox value={filters.debtor} onChange={(v) => set('debtor', v)} options={options.debtors} placeholder="All Debtors" ariaLabel="Debtor" />
  )
  const creditor = (
    <Combobox value={filters.creditor} onChange={(v) => set('creditor', v)} options={options.creditors} placeholder="All Creditors" ariaLabel="Creditor" />
  )

  return (
    <>
      {/* Mobile — fixed-width rows, 2 fields each, 3 in the last (with trailing) */}
      <div className="sm:hidden w-full space-y-2">
        <div className="flex items-center gap-2">
          {dateFrom}
          <span className="text-gray-400 text-sm shrink-0">–</span>
          {dateTo}
        </div>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">{branch}</div>
          <div className="flex-1 min-w-0">{salesAgent}</div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">{debtor}</div>
          <div className="flex-1 min-w-0">{creditor}</div>
        </div>
        {/* Toggle sits left of the field it controls — paired together so
            the relationship is visually obvious. */}
        {toggle && (
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">{toggle}</div>
            <div className="flex-1 min-w-0">{itemDynamic}</div>
          </div>
        )}
        {/* auto-fit lets this row hold 3 equal columns when there's room, but
            drop to 2-then-1 per row as the screen narrows, instead of forcing
            a fixed 33% that would squeeze labels into truncation. Only
            carries itemDynamic itself when there's no toggle to pair it with. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(175px,1fr))] gap-2">
          {!toggle && <div className="min-w-0">{itemDynamic}</div>}
          {trailing.map((node, i) => <div key={i} className="min-w-0">{node}</div>)}
        </div>
      </div>

      {/* Desktop — single wrapped line, unchanged from before */}
      <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-2">
        {dateFrom}
        <span className="text-gray-400 text-sm">–</span>
        {dateTo}
        {branch}
        {toggle}
        {itemDynamic}
        {salesAgent}
        {debtor}
        {creditor}
        {trailing.map((node, i) => <span key={i} className="contents">{node}</span>)}
      </div>
    </>
  )
}
