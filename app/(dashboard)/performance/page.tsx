'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FilterOptions, Filters, GroupByMode, PerformanceRow } from '@/types'
import { DEFAULT_FILTERS, DEFAULT_OPTIONS, toParams } from '@/lib/filters'
import { pivotRevenueByCurrency } from '@/lib/currency'
import { entityRevenueColumns } from '@/lib/export'
import FilterBar from '@/components/filter-bar'
import GroupByToggle from '@/components/group-by-toggle'
import BarChartWidget from '@/components/bar-chart'
import PerformanceTable from '@/components/performance-table'
import ExportModal, { ExportChartSpec, ExportTableSpec } from '@/components/export-modal'
import { Download } from 'lucide-react'

const ENTITY_FIELDS = ['branch', 'item', 'sales_agent', 'debtor', 'creditor'] as const
type EntityField = (typeof ENTITY_FIELDS)[number]

const GROUP_LABEL: Record<GroupByMode, string> = { item: 'Item', group: 'Group', type: 'Type' }

function chartData(rows: PerformanceRow[]) {
  return pivotRevenueByCurrency(
    rows.map((r) => ({ ...r, total_revenue: r.credit_revenue + r.cash_revenue, total_qty: r.credit_qty + r.cash_qty })),
    (r) => r.name
  )
}

export default function PerformancePage() {
  const supabase = createClient()

  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS)
  const [options, setOptions] = useState<FilterOptions>(DEFAULT_OPTIONS)
  const [groupBy, setGroupBy] = useState<GroupByMode>('item')
  const [branchRows, setBranchRows] = useState<PerformanceRow[]>([])
  const [itemRows, setItemRows] = useState<PerformanceRow[]>([])
  const [agentRows, setAgentRows] = useState<PerformanceRow[]>([])
  const [debtorRows, setDebtorRows] = useState<PerformanceRow[]>([])
  const [creditorRows, setCreditorRows] = useState<PerformanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => { fetchOptions() }, [])
  useEffect(() => { fetchData() }, [filters, groupBy])

  async function fetchOptions() {
    const { data } = await supabase.rpc('get_filter_options_v2')
    if (data?.[0]) setOptions(data[0] as FilterOptions)
  }

  // Enforces the single global focus: whichever of the 5 entity fields just
  // changed to a non-empty value clears the other four. Both the FilterBar
  // (select-or-type) and clicking a table row funnel through this — they're
  // just two input methods for the same one focus (PLAN.md Section 3).
  function setFilters(next: Filters) {
    const changed = ENTITY_FIELDS.find((k) => next[k] !== filters[k])
    if (changed && next[changed]) {
      const cleared = { ...next }
      for (const k of ENTITY_FIELDS) if (k !== changed) cleared[k] = ''
      setFiltersState(cleared)
    } else {
      setFiltersState(next)
    }
  }

  function toggleFocus(field: EntityField, id: string) {
    setFilters({ ...filters, [field]: filters[field] === id ? '' : id })
  }

  async function fetchData() {
    setLoading(true)
    const p = toParams(filters)
    const common = { p_date_from: p.p_date_from, p_date_to: p.p_date_to, p_item_group: p.p_item_group, p_item_type: p.p_item_type }

    const [branchRes, itemRes, agentRes, debtorRes, creditorRes] = await Promise.all([
      supabase.rpc('get_performance_branch_v2', { ...common, p_item: p.p_item, p_sales_agent: p.p_sales_agent, p_debtor: p.p_debtor, p_creditor: p.p_creditor }),
      supabase.rpc('get_performance_item_v2', { ...common, p_branch: p.p_branch, p_sales_agent: p.p_sales_agent, p_debtor: p.p_debtor, p_creditor: p.p_creditor, p_group_by: groupBy }),
      supabase.rpc('get_performance_sales_agent_v2', { ...common, p_branch: p.p_branch, p_item: p.p_item, p_debtor: p.p_debtor, p_creditor: p.p_creditor }),
      supabase.rpc('get_performance_debtor_v2', { ...common, p_branch: p.p_branch, p_item: p.p_item, p_sales_agent: p.p_sales_agent, p_creditor: p.p_creditor }),
      supabase.rpc('get_performance_creditor_v2', { ...common, p_branch: p.p_branch, p_item: p.p_item, p_sales_agent: p.p_sales_agent, p_debtor: p.p_debtor }),
    ])

    for (const [label, res] of [['branch', branchRes], ['item', itemRes], ['sales_agent', agentRes], ['debtor', debtorRes], ['creditor', creditorRes]] as const) {
      if (res.error) console.error(`get_performance_${label}_v2 error:`, res.error.message)
    }

    setBranchRows((branchRes.data as PerformanceRow[]) ?? [])
    setItemRows((itemRes.data as PerformanceRow[]) ?? [])
    setAgentRows((agentRes.data as PerformanceRow[]) ?? [])
    setDebtorRows((debtorRes.data as PerformanceRow[]) ?? [])
    setCreditorRows((creditorRes.data as PerformanceRow[]) ?? [])
    setLoading(false)
  }

  function focusedEntity(): { field: EntityField; name: string } | null {
    for (const field of ENTITY_FIELDS) {
      if (!filters[field]) continue
      const list =
        field === 'branch' ? options.branches :
        field === 'item' ? options.items :
        field === 'sales_agent' ? options.sales_agents :
        field === 'debtor' ? options.debtors : options.creditors
      return { field, name: list.find((o) => o.id === filters[field])?.name ?? '' }
    }
    return null
  }

  const focus = focusedEntity()
  function titleFor(field: EntityField, base: string) {
    if (!focus || focus.field === field) return base
    return `${base} — ${focus.name}`
  }

  const itemLabel = GROUP_LABEL[groupBy]
  const sections: { field: EntityField; title: string; rows: PerformanceRow[]; setRows: (id: string) => void }[] = [
    { field: 'branch', title: titleFor('branch', 'Branch Breakdown'), rows: branchRows, setRows: (id) => toggleFocus('branch', id) },
    { field: 'item', title: titleFor('item', `${itemLabel} Breakdown`), rows: itemRows, setRows: (id) => toggleFocus('item', id) },
    { field: 'sales_agent', title: titleFor('sales_agent', 'Sales Agent Breakdown'), rows: agentRows, setRows: (id) => toggleFocus('sales_agent', id) },
    { field: 'debtor', title: titleFor('debtor', 'Debtor Breakdown'), rows: debtorRows, setRows: (id) => toggleFocus('debtor', id) },
    { field: 'creditor', title: titleFor('creditor', 'Creditor Breakdown'), rows: creditorRows, setRows: (id) => toggleFocus('creditor', id) },
  ]

  const exportCharts: ExportChartSpec[] = sections.map((s) => ({
    id: `${s.field}-chart`, label: `Top 5 ${s.title}`, render: () => <BarChartWidget data={chartData(s.rows)} />,
  }))
  const exportTables: ExportTableSpec[] = sections.map((s) => ({
    id: `${s.field}-table`, label: s.title,
    columns: entityRevenueColumns('name', s.field === 'item' ? itemLabel : s.title.split(' Breakdown')[0]),
    rows: s.rows as unknown as Record<string, unknown>[],
  }))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Performance</h1>
          <p className="text-sm text-gray-500">Branch, Item, Sales Agent, Debtor, and Creditor performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterBar filters={filters} options={options} onChange={setFilters} />
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map((s) => (
          <div key={s.field} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Top 5 {s.title}</h3>
              {s.field === 'item' && <GroupByToggle value={groupBy} onChange={setGroupBy} />}
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-[260px]">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <BarChartWidget data={chartData(s.rows)} />
            )}
          </div>
        ))}
      </div>

      {/* Tables */}
      <div className="space-y-4">
        {sections.map((s) => (
          <PerformanceTable
            key={s.field}
            title={s.title}
            rows={s.rows}
            loading={loading}
            focusedId={filters[s.field] || null}
            onRowClick={s.setRows}
          />
        ))}
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        pageTitle="Performance"
        filters={filters}
        options={options}
        charts={exportCharts}
        tables={exportTables}
      />
    </div>
  )
}
