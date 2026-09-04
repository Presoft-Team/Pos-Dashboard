'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { SalesAgentCatalogRow } from '@/types'
import { toParams } from '@/lib/filters'
import { useSharedFilters } from '@/lib/filter-context'
import { formatMoney, formatQty } from '@/lib/currency'
import DatePresetFilter from '@/components/date-preset-filter'
import SortSelect, { SortOption } from '@/components/sort-select'
import EntityDetail, { EntityTarget } from '@/components/entity-detail'

const SORT_OPTIONS: readonly SortOption[] = [
  { value: 'revenue_asc', label: 'Revenue' },
  { value: 'revenue_desc', label: 'Revenue desc' },
  { value: 'documents_desc', label: 'Documents desc' },
  { value: 'name', label: 'Name' },
] as const

const LIST_INITIAL_VISIBLE = 5
const LIST_SHOW_MORE_STEP = 5

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 break-words">{value}</p>
    </div>
  )
}

// DocDate is a datetime; only the date part means anything here. Sliced
// rather than parsed via Date — the value is local wall-clock time from SQL
// Server, and new Date() would shift it by the browser's zone.
function formatDate(value: string): string {
  return value ? value.slice(0, 10) : '—'
}

// Sales agent list, in the same card layout as Item/Debtor/Creditor — but
// AutoCount has no sales-agent master table (SalesAgent is a plain column on
// sales documents), so there is no address or credit term to show. Every
// figure on a card is derived from the documents the agent appears on, which
// is why this page carries a date filter and the other catalog pages don't.
export default function SalesAgentPage() {
  const supabase = createClient()

  const { filters, setFilters, options } = useSharedFilters()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('revenue_desc')
  const [rows, setRows] = useState<SalesAgentCatalogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(LIST_INITIAL_VISIBLE)
  const [detail, setDetail] = useState<EntityTarget | null>(null)

  // Debounced so fast typing doesn't fire an RPC call per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchData, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, filters])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_sales_agent_catalog_v2', {
      ...toParams(filters),
      p_search: search.trim() || null,
      p_sort: sort,
      p_limit: null,
    })
    if (error) console.error('get_sales_agent_catalog_v2 error:', error.message)
    setRows((data as SalesAgentCatalogRow[]) ?? [])
    setVisibleCount(LIST_INITIAL_VISIBLE)
    setLoading(false)
  }

  const visibleRows = rows.slice(0, visibleCount)
  const hasMore = visibleCount < rows.length
  const isExpanded = visibleCount > LIST_INITIAL_VISIBLE

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Agent</h1>
          <p className="text-sm text-gray-500">
            {search.trim() ? 'Search results' : 'Browse sales agents and their activity'}
          </p>
        </div>
        <DatePresetFilter filters={filters} options={options} onChange={setFilters} />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by agent name…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
        <SortSelect value={sort} options={SORT_OPTIONS} onChange={setSort} ariaLabel="Sort by" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          No sales agents found in this date range
        </div>
      ) : (
        <div className="space-y-4">
          {visibleRows.map((row) => (
            <div
              key={row.name}
              onClick={() => setDetail({ kind: 'sales_agent', code: row.name, name: row.name })}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:border-gray-300 hover:shadow transition-colors"
            >
              <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  {row.has_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/presoft/sales-agents/${encodeURIComponent(row.name)}/image`}
                      alt={row.name}
                      className="w-12 h-12 rounded-lg object-cover border border-gray-100 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 shrink-0" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{row.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatQty(row.document_count)} document{row.document_count === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">Revenue</p>
                  <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                    {formatMoney(row.revenue, row.currency)}
                  </p>
                </div>
              </div>

              <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                <Stat label="Documents" value={formatQty(row.document_count)} />
                <Stat label="Debtors Billed" value={formatQty(row.debtor_count)} />
                {/* Comes off Debtor.SalesAgent, so it ignores the date range
                    and can be 0 while revenue is not — an agent can sell to
                    debtors who were never formally assigned to them. */}
                <Stat label="Assigned Debtors" value={formatQty(row.assigned_debtors)} />
                <Stat label="First Document" value={formatDate(row.first_doc_date)} />
                <Stat label="Last Document" value={formatDate(row.last_doc_date)} />
                <Stat
                  label="Avg per Document"
                  value={formatMoney(
                    row.document_count ? row.revenue / row.document_count : 0,
                    row.currency
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <EntityDetail target={detail} onClose={() => setDetail(null)} filters={filters} />

      {!loading && (hasMore || isExpanded) && (
        <div className="flex items-center justify-center gap-3">
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => Math.min(c + LIST_SHOW_MORE_STEP, rows.length))}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show 5 more
            </button>
          )}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(rows.length)}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show all
            </button>
          )}
          {isExpanded && (
            <button
              onClick={() => setVisibleCount(LIST_INITIAL_VISIBLE)}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  )
}
