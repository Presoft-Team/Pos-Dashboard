'use client'

import type { ReactNode } from 'react'
import { FilterOptions, Filters } from '@/types'

interface Props {
  filters: Filters
  options: FilterOptions
  onChange: (f: Filters) => void
  // Each element is one "slot" (e.g. the Group/Type toggle, the Export
  // button). On mobile they share the last row with Item Type, one slot per
  // column; on desktop they render inline after the filters, same place
  // they used to sit as the page's own siblings.
  trailing?: ReactNode[]
}

// Global FilterBar (PLAN.md Section 3) — shared by Sales Dashboard, Monthly
// Sales, Performance, and Item pages. Date range + 5 entity fields (Branch,
// Item, Sales Agent, Debtor, Creditor) + Item Group/Item Type. Each entity
// field is a native <select> — browsers already support jumping to an
// option by typing its first letters, covering "select or type" without a
// custom combobox.
//
// Two separate layouts, not one responsive one: mobile groups fields into
// fixed-width rows (2 filters per row, 3 in the last with `trailing`) so
// every row lines up at a consistent width; desktop keeps a single
// natural-wrapping line. The two structures are different enough that
// forcing one grid to serve both breakpoints was messier than just
// rendering the fields twice. `w-full sm:w-auto` on each field is what lets
// the same element fill its mobile row slot but stay intrinsic-width on
// desktop.
export default function FilterBar({ filters, options, onChange, trailing = [] }: Props) {
  function set(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value })
  }

  const selectClass =
    'h-9 min-w-0 w-full sm:w-auto pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent'
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
    <select value={filters.branch} onChange={(e) => set('branch', e.target.value)} className={selectClass} aria-label="Branch">
      <option value="">All Branches</option>
      {options.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  )
  const item = (
    <select value={filters.item} onChange={(e) => set('item', e.target.value)} className={selectClass} aria-label="Item">
      <option value="">All Items</option>
      {options.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
    </select>
  )
  const salesAgent = (
    <select value={filters.sales_agent} onChange={(e) => set('sales_agent', e.target.value)} className={selectClass} aria-label="Sales Agent">
      <option value="">All Sales Agents</option>
      {options.sales_agents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  )
  const debtor = (
    <select value={filters.debtor} onChange={(e) => set('debtor', e.target.value)} className={selectClass} aria-label="Debtor">
      <option value="">All Debtors</option>
      {options.debtors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  )
  const creditor = (
    <select value={filters.creditor} onChange={(e) => set('creditor', e.target.value)} className={selectClass} aria-label="Creditor">
      <option value="">All Creditors</option>
      {options.creditors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
  const itemGroup = (
    <select value={filters.item_group} onChange={(e) => set('item_group', e.target.value)} className={selectClass} aria-label="Item Group">
      <option value="">All Item Groups</option>
      {options.item_groups.map((g) => <option key={g} value={g}>{g}</option>)}
    </select>
  )
  const itemType = (
    <select value={filters.item_type} onChange={(e) => set('item_type', e.target.value)} className={selectClass} aria-label="Item Type">
      <option value="">All Item Types</option>
      {options.item_types.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
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
          <div className="flex-1 min-w-0">{item}</div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">{salesAgent}</div>
          <div className="flex-1 min-w-0">{debtor}</div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">{creditor}</div>
          <div className="flex-1 min-w-0">{itemGroup}</div>
        </div>
        {/* auto-fit lets this row hold 3 equal columns when there's room, but
            drop to 2-then-1 per row as the screen narrows, instead of forcing
            a fixed 33% that would squeeze the toggle's "Item/Group/Type"
            labels into truncation. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(175px,1fr))] gap-2">
          <div className="min-w-0">{itemType}</div>
          {trailing.map((node, i) => <div key={i} className="min-w-0">{node}</div>)}
        </div>
      </div>

      {/* Desktop — single wrapped line, unchanged from before */}
      <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-2">
        {dateFrom}
        <span className="text-gray-400 text-sm">–</span>
        {dateTo}
        {branch}
        {item}
        {salesAgent}
        {debtor}
        {creditor}
        {itemGroup}
        {itemType}
        {trailing.map((node, i) => <span key={i} className="contents">{node}</span>)}
      </div>
    </>
  )
}
