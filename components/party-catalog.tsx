'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { PartyCatalogRow } from '@/types'
import { formatMoney } from '@/lib/currency'
import { useSharedFilters } from '@/lib/filter-context'
import SortSelect, { SortOption } from '@/components/sort-select'
import EntityDetail, { EntityKind, EntityTarget } from '@/components/entity-detail'

const SORT_OPTIONS: readonly SortOption[] = [
  { value: 'code', label: 'Code' },
  { value: 'name', label: 'Name' },
  { value: 'outstanding_asc', label: 'Outstanding' },
  { value: 'outstanding_desc', label: 'Outstanding desc' },
  { value: 'credit_limit_desc', label: 'Credit Limit desc' },
] as const

const LIST_INITIAL_VISIBLE = 5
const LIST_SHOW_MORE_STEP = 5

// One label/value pair. Renders nothing at all when the value is empty —
// these are optional fields on the master record, and a blank row reads as
// "this is missing" rather than "this was never filled in".
function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value}</p>
    </div>
  )
}

// AutoCount splits the address across four free-text lines plus a postcode,
// with no rule about which line holds what. Joined in order, skipping the
// blanks, rather than guessing at street/city/state.
function addressOf(row: PartyCatalogRow): string {
  return [row.address1, row.address2, row.address3, row.address4, row.post_code]
    .filter(Boolean)
    .join(', ')
}

interface Props {
  // "Debtor" / "Creditor" — used for the heading, the empty state, and the
  // agent field's label, which differs by side.
  title: string
  subtitle: string
  rpc: string
  agentLabel: string
  // Which detail overlay a card opens.
  kind: EntityKind
}

// Shared card list behind both the Debtor and Creditor pages. AutoCount's
// Debtor and Creditor masters are the same shape down to the column names,
// so the two pages differ only in their title and which RPC they read —
// not enough to justify two copies of this.
export default function PartyCatalog({ title, subtitle, rpc, agentLabel, kind }: Props) {
  const supabase = createClient()

  // Only for the date range the detail overlay's history honours — this
  // page's own list is master data and isn't date-filtered.
  const { filters } = useSharedFilters()
  const [detail, setDetail] = useState<EntityTarget | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('code')
  const [rows, setRows] = useState<PartyCatalogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(LIST_INITIAL_VISIBLE)

  // Debounced so fast typing doesn't fire an RPC call per keystroke — same
  // 300ms the Item page uses.
  useEffect(() => {
    const t = setTimeout(fetchData, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase.rpc(rpc, {
      p_search: search.trim() || null,
      p_sort: sort,
      p_limit: null,
    })
    if (error) console.error(`${rpc} error:`, error.message)
    setRows((data as PartyCatalogRow[]) ?? [])
    setVisibleCount(LIST_INITIAL_VISIBLE)
    setLoading(false)
  }

  const visibleRows = rows.slice(0, visibleCount)
  const hasMore = visibleCount < rows.length
  const isExpanded = visibleCount > LIST_INITIAL_VISIBLE

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">{search.trim() ? 'Search results' : subtitle}</p>
      </div>

      {/* Search + sort icon, same row at every width. */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search by ${title.toLowerCase()} name or code…`}
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
          No {title.toLowerCase()}s found
        </div>
      ) : (
        <div className="space-y-4">
          {visibleRows.map((row) => {
            const address = addressOf(row)
            const phones = [row.phone1, row.phone2, row.mobile].filter(Boolean).join(' · ')
            return (
              <div
                key={row.acc_no}
                onClick={() => setDetail({ kind, code: row.acc_no, name: row.company_name || row.acc_no })}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:border-gray-300 hover:shadow transition-colors"
              >
                <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{row.company_name || row.acc_no}</h3>
                      {/* Inactive is worth calling out; active is the norm
                          and would just be visual noise on every card. */}
                      {!row.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {row.acc_no}
                      {row.name2 && ` · ${row.name2}`}
                      {row.party_type && ` · ${row.party_type}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Outstanding</p>
                    <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                      {formatMoney(row.outstanding, row.currency)}
                    </p>
                  </div>
                </div>

                <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <Field label="Attention" value={row.attention} />
                  <Field label="Phone" value={phones} />
                  <Field label="Email" value={row.email} />
                  <Field label="Fax" value={row.fax1} />
                  <Field label="Website" value={row.website} />
                  <Field label="Address" value={address} />
                  <Field label="Credit Term" value={row.credit_term} />
                  {/* A credit limit of 0 means "no limit set" in AutoCount,
                      so it's hidden rather than shown as RM 0.00. */}
                  <Field
                    label="Credit Limit"
                    value={row.credit_limit ? formatMoney(row.credit_limit, row.currency) : ''}
                  />
                  <Field label={agentLabel} value={row.agent} />
                  <Field label="Registration No" value={row.register_no} />
                  <Field label="Currency" value={row.currency} />
                </div>
              </div>
            )
          })}
        </div>
      )}

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

      <EntityDetail target={detail} onClose={() => setDetail(null)} filters={filters} />
    </div>
  )
}
