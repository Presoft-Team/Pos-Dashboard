'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { DocumentRow, Filters, PartyCatalogRow, PerformanceItemRow, SalesAgentCatalogRow } from '@/types'
import { toParams } from '@/lib/filters'
import { formatMoney, formatQty } from '@/lib/currency'
import { withoutUnattributed } from '@/lib/breakdown'
import DetailOverlay from '@/components/detail-overlay'
import DocumentTable from '@/components/document-table'
import DocumentDetail, { DocumentTarget } from '@/components/document-detail'
import PerformanceTable from '@/components/performance-table'

// Which kind of thing is open. Drives both the RPCs used and what the body
// renders — the three party kinds carry a document history, an item does
// not (no endpoint returns per-item documents yet).
export type EntityKind = 'debtor' | 'creditor' | 'sales_agent'

export interface EntityTarget {
  kind: EntityKind
  // Debtor/creditor AccNo, or the agent's name — agents have no master
  // table, so their name is the key.
  code: string
  // What to show in the header while the record loads.
  name: string
}

const KIND_LABEL: Record<EntityKind, string> = {
  debtor: 'Debtor',
  creditor: 'Creditor',
  sales_agent: 'Sales Agent',
}

// The item dimensions available on the agent breakdown — mirrors ITEM_DIMENSIONS
// in sales-dimension-page.tsx.
const ITEM_DIMENSIONS = [
  { key: 'item', label: 'Item' },
  { key: 'item_group', label: 'Group' },
  { key: 'item_type', label: 'Type' },
  { key: 'item_brand', label: 'Brand' },
  { key: 'item_class', label: 'Class' },
  { key: 'item_category', label: 'Category' },
] as const

type ItemDimension = (typeof ITEM_DIMENSIONS)[number]['key']

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-base font-semibold text-gray-900 mt-0.5 break-words">{value}</p>
    </div>
  )
}

function addressOf(row: PartyCatalogRow): string {
  return [row.address1, row.address2, row.address3, row.address4, row.post_code]
    .filter(Boolean)
    .join(', ')
}

function formatDate(value: string): string {
  return value ? value.slice(0, 10) : '—'
}

interface Props {
  target: EntityTarget | null
  onClose: () => void
  // The page's active filters — the history honours the same date range the
  // list behind the overlay was showing, so the two agree.
  filters: Filters
}

// Full-screen detail for one debtor, creditor, or sales agent: its record up
// top, then its document history. Opened from any breakdown row or catalog
// card; closed with the X or Escape.
export default function EntityDetail({ target, onClose, filters }: Props) {
  const supabase = createClient()

  const [party, setParty] = useState<PartyCatalogRow | null>(null)
  const [agent, setAgent] = useState<SalesAgentCatalogRow | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [docDetail, setDocDetail] = useState<DocumentTarget | null>(null)

  // Agent item breakdown state — only populated when isAgent.
  const [itemDimension, setItemDimension] = useState<ItemDimension>('item')
  const [itemRows, setItemRows] = useState<PerformanceItemRow[]>([])
  const [itemLoading, setItemLoading] = useState(false)

  useEffect(() => {
    if (!target) return
    // Guards against a slow response for a previously-opened entity landing
    // after the user has already closed it or switched to another one.
    let cancelled = false

    async function fetchDetail() {
      if (!target) return
      setLoading(true)
      setParty(null)
      setAgent(null)
      setDocuments([])

      const dateRange = toParams(filters)

      if (target.kind === 'sales_agent') {
        const [agentRes, docsRes] = await Promise.all([
          supabase.rpc('get_sales_agent_catalog_v2', { ...dateRange, p_search: target.code, p_limit: null }),
          supabase.rpc('get_recent_sales_v2', { ...dateRange, p_sales_agent: target.code, p_limit: null }),
        ])
        if (cancelled) return
        if (agentRes.error) console.error('get_sales_agent_catalog_v2 error:', agentRes.error.message)
        if (docsRes.error) console.error('get_recent_sales_v2 error:', docsRes.error.message)
        // p_search is a LIKE, so it can match more than one agent — keep the
        // exact name, not merely the first row back.
        const rows = (agentRes.data as SalesAgentCatalogRow[]) ?? []
        setAgent(rows.find((a) => a.name === target.code || a.name === target.name) ?? rows[0] ?? null)
        setDocuments((docsRes.data as DocumentRow[]) ?? [])
      } else {
        const isDebtor = target.kind === 'debtor'
        const [partyRes, docsRes] = await Promise.all([
          supabase.rpc(isDebtor ? 'get_debtor_catalog_v2' : 'get_creditor_catalog_v2', {
            p_search: target.code, p_limit: null,
          }),
          supabase.rpc(isDebtor ? 'get_recent_sales_v2' : 'get_recent_purchases_v2', {
            ...dateRange,
            ...(isDebtor ? { p_debtor: target.code } : { p_creditor: target.code }),
            p_limit: null,
          }),
        ])
        if (cancelled) return
        if (partyRes.error) console.error('party catalog error:', partyRes.error.message)
        if (docsRes.error) console.error('document history error:', docsRes.error.message)
        const rows = (partyRes.data as PartyCatalogRow[]) ?? []
        setParty(rows.find((p) => p.acc_no === target.code) ?? rows[0] ?? null)
        setDocuments((docsRes.data as DocumentRow[]) ?? [])
      }
      setLoading(false)
    }

    fetchDetail()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, filters])

  // Fetch item breakdown whenever the agent, filters, or dimension change.
  useEffect(() => {
    if (!target || target.kind !== 'sales_agent') return
    let cancelled = false

    async function fetchItemRows() {
      if (!target) return
      setItemLoading(true)
      const dateRange = toParams(filters)
      const res = await supabase.rpc('get_sales_by_v2', {
        ...dateRange,
        p_sales_by: itemDimension,
        p_agent: target.code,
        p_limit: null,
      })
      if (cancelled) return
      if (res.error) console.error(`get_sales_by_v2 (${itemDimension}) error:`, res.error.message)
      setItemRows(withoutUnattributed((res.data as PerformanceItemRow[]) ?? [], false))
      setItemLoading(false)
    }

    fetchItemRows()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, filters, itemDimension])

  if (!target) return null

  const isDebtor = target.kind === 'debtor'
  const isAgent = target.kind === 'sales_agent'
  const displayName = party?.company_name || agent?.name || target.name
  const currency = party?.currency ?? agent?.currency ?? 'MYR'

  // Totalled from the history itself rather than re-fetching an aggregate,
  // so the figure and the rows below it can never disagree. Signed, so
  // credit notes and returns reduce it exactly as they do the KPI tiles.
  const total = documents.reduce((sum, d) => sum + d.amount, 0)

  const subtitleParts = [
    KIND_LABEL[target.kind],
    !isAgent ? target.code : '',
    filters.date_from || filters.date_to
      ? `${filters.date_from || 'earliest'} → ${filters.date_to || 'latest'}`
      : 'All dates',
  ].filter(Boolean)

  const itemLabel = ITEM_DIMENSIONS.find((d) => d.key === itemDimension)?.label ?? 'Item'

  return (
    <DetailOverlay open onClose={onClose} title={displayName} subtitle={subtitleParts.join(' · ')}>
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Sales agent top card with image */}
          {isAgent && agent && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-4">
                {agent.has_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/presoft/sales-agents/${encodeURIComponent(agent.name)}/image`}
                    alt={agent.name}
                    className="w-20 h-20 rounded-lg object-cover border border-gray-100 shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gray-50 border border-gray-100 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 flex-1">
                  <div>
                    <p className="text-xs text-gray-400">Revenue</p>
                    <p className="text-sm font-semibold text-gray-900">{formatMoney(total, currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Documents</p>
                    <p className="text-sm text-gray-800">{formatQty(documents.length)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Debtors Billed</p>
                    <p className="text-sm text-gray-800">{formatQty(agent.debtor_count)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Assigned Debtors</p>
                    <p className="text-sm text-gray-800">{formatQty(agent.assigned_debtors)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">First Document</p>
                    <p className="text-sm text-gray-800">{formatDate(agent.first_doc_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Last Document</p>
                    <p className="text-sm text-gray-800">{formatDate(agent.last_doc_date)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Party (Debtor/Creditor) Headline figures */}
          {!isAgent && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat label={isDebtor ? 'Revenue' : 'Purchase'} value={formatMoney(total, currency)} />
              <Stat label="Documents" value={formatQty(documents.length)} />
              {party && <Stat label="Outstanding" value={formatMoney(party.outstanding, party.currency)} />}
            </div>
          )}

          {/* Master record — agents have none, so this block is party-only */}
          {party && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 text-sm">Details</h3>
                {!party.is_active && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                )}
              </div>
              <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Account Code" value={party.acc_no} />
                <Field label="Type" value={party.party_type} />
                <Field label="Attention" value={party.attention} />
                <Field
                  label="Phone"
                  value={[party.phone1, party.phone2, party.mobile].filter(Boolean).join(' · ')}
                />
                <Field label="Email" value={party.email} />
                <Field label="Fax" value={party.fax1} />
                <Field label="Website" value={party.website} />
                <Field label="Address" value={addressOf(party)} />
                <Field label="Credit Term" value={party.credit_term} />
                {/* 0 means "no limit set" in AutoCount — hidden, not shown
                    as a misleading RM 0.00. */}
                <Field
                  label="Credit Limit"
                  value={party.credit_limit ? formatMoney(party.credit_limit, party.currency) : ''}
                />
                <Field label={isDebtor ? 'Sales Agent' : 'Purchase Agent'} value={party.agent} />
                <Field label="Registration No" value={party.register_no} />
                <Field label="Currency" value={party.currency} />
              </div>
            </div>
          )}

          {/* Item breakdown — agent-only. Same dimension toggle + PerformanceTable
              logic as sales-dimension-page, with search & sort inside the table.
              The toggle uses a 3-column grid on mobile (2 rows of 3 buttons)
              and collapses to a single row on sm+. */}
          {isAgent && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">{itemLabel} Breakdown</h3>
                <div className="grid grid-cols-3 sm:flex sm:flex-row rounded-lg border border-gray-200 bg-white p-0.5 gap-0.5">
                  {ITEM_DIMENSIONS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setItemDimension(d.key)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap text-center ${
                        itemDimension === d.key ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <PerformanceTable
                title=""
                rows={itemRows}
                loading={itemLoading}
                showQty
              />
            </div>
          )}

          {/* History — rows drill into the document's own detail. That
              overlay stacks above this one, so closing it returns here
              rather than all the way out to the page. */}
          <DocumentTable
            title="History"
            rows={documents}
            partyLabel={isDebtor || isAgent ? 'Debtor' : 'Creditor'}
            // Every row here belongs to this same debtor/creditor, so the
            // party column would repeat one value down the page. An agent's
            // history does vary by debtor, so that one keeps the party.
            middle={isAgent ? 'party' : 'type'}
            onRowClick={(row) => setDocDetail({ row, side: isAgent || isDebtor ? 'sales' : 'purchase' })}
          />

          <DocumentDetail target={docDetail} onClose={() => setDocDetail(null)} layer="above" />
        </>
      )}
    </DetailOverlay>
  )
}
