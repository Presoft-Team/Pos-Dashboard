'use client'

import { FilterOptions, Filters } from '@/types'

interface Props {
  filters: Filters
  options: FilterOptions
  onChange: (f: Filters) => void
}

// Global FilterBar (PLAN.md Section 3) — shared by Sales Dashboard, Monthly
// Sales, Performance, and Item pages. Date range + 5 entity fields (Branch,
// Item, Sales Agent, Debtor, Creditor) + Item Group/Item Type. Each entity
// field is a native <select> — browsers already support jumping to an
// option by typing its first letters, covering "select or type" without a
// custom combobox.
export default function FilterBar({ filters, options, onChange }: Props) {
  function set(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value })
  }

  const selectClass =
    'h-9 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent'
  const dateClass =
    'h-9 pl-3 pr-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date range */}
      <input
        type="date"
        value={filters.date_from}
        onChange={(e) => set('date_from', e.target.value)}
        min={options.date_min ?? undefined}
        max={options.date_max ?? undefined}
        className={dateClass}
        aria-label="From date"
      />
      <span className="text-gray-400 text-sm">–</span>
      <input
        type="date"
        value={filters.date_to}
        onChange={(e) => set('date_to', e.target.value)}
        min={options.date_min ?? undefined}
        max={options.date_max ?? undefined}
        className={dateClass}
        aria-label="To date"
      />

      <select value={filters.branch} onChange={(e) => set('branch', e.target.value)} className={selectClass} aria-label="Branch">
        <option value="">All Branches</option>
        {options.branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      <select value={filters.item} onChange={(e) => set('item', e.target.value)} className={selectClass} aria-label="Item">
        <option value="">All Items</option>
        {options.items.map((i) => (
          <option key={i.id} value={i.id}>{i.name}</option>
        ))}
      </select>

      <select value={filters.sales_agent} onChange={(e) => set('sales_agent', e.target.value)} className={selectClass} aria-label="Sales Agent">
        <option value="">All Sales Agents</option>
        {options.sales_agents.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      <select value={filters.debtor} onChange={(e) => set('debtor', e.target.value)} className={selectClass} aria-label="Debtor">
        <option value="">All Debtors</option>
        {options.debtors.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>

      <select value={filters.creditor} onChange={(e) => set('creditor', e.target.value)} className={selectClass} aria-label="Creditor">
        <option value="">All Creditors</option>
        {options.creditors.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select value={filters.item_group} onChange={(e) => set('item_group', e.target.value)} className={selectClass} aria-label="Item Group">
        <option value="">All Item Groups</option>
        {options.item_groups.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>

      <select value={filters.item_type} onChange={(e) => set('item_type', e.target.value)} className={selectClass} aria-label="Item Type">
        <option value="">All Item Types</option>
        {options.item_types.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  )
}
