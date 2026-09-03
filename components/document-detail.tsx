'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { DocumentLineRow, DocumentRow } from '@/types'
import { formatMoney, formatQty } from '@/lib/currency'
import DetailOverlay from '@/components/detail-overlay'

export interface DocumentTarget {
  row: DocumentRow
  // Which family of stock tables holds the lines — a DocNo alone doesn't say.
  side: 'sales' | 'purchase'
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value}</p>
    </div>
  )
}

interface Props {
  target: DocumentTarget | null
  onClose: () => void
  // 'above' when opened from inside an entity's history, so it stacks over
  // that overlay instead of being painted behind it.
  layer?: 'base' | 'above'
}

// Everything about one document that the three-column list deliberately
// leaves out: doc no, type, sales agent, location, and the item lines with
// their codes and quantities.
export default function DocumentDetail({ target, onClose, layer = 'base' }: Props) {
  const supabase = createClient()

  const [lines, setLines] = useState<DocumentLineRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!target) return
    // Guards against a slow response for a previously-opened document
    // landing after the user has closed it or opened another.
    let cancelled = false

    async function fetchLines() {
      if (!target) return
      setLoading(true)
      setLines([])
      const { data, error } = await supabase.rpc('get_document_lines_v2', {
        p_doc_no: target.row.doc_no,
        p_side: target.side,
      })
      if (cancelled) return
      if (error) console.error('get_document_lines_v2 error:', error.message)
      setLines((data as DocumentLineRow[]) ?? [])
      setLoading(false)
    }

    fetchLines()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  if (!target) return null

  const { row, side } = target
  const isSales = side === 'sales'
  // Location is a header field, so every line shares it — read it off the
  // first line rather than printing it once per row in the table.
  const location = lines.find((l) => l.location)?.location ?? ''
  const totalQty = lines.reduce((sum, l) => sum + l.qty, 0)

  return (
    <DetailOverlay
      open
      onClose={onClose}
      layer={layer}
      title={row.doc_no}
      subtitle={`${row.doc_type} · ${row.doc_date.slice(0, 10)}`}
    >
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <h3 className="font-semibold text-gray-900 text-sm">Document</h3>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">Amount</p>
            <p className={`text-sm font-semibold whitespace-nowrap ${row.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {formatMoney(row.amount, row.currency)}
            </p>
          </div>
        </div>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <Field label="Doc No" value={row.doc_no} />
          <Field label="Type" value={row.doc_type} />
          <Field label="Date" value={row.doc_date.slice(0, 10)} />
          <Field label={isSales ? 'Debtor' : 'Creditor'} value={row.party_name} />
          <Field label="Account Code" value={row.party_code} />
          {/* Sales only — AP documents carry no SalesAgent at all. Also
              empty on a credit note, where ARCN doesn't record one. */}
          {isSales && <Field label="Sales Agent" value={row.agent} />}
          <Field label="Location" value={location} />
          <Field label="Currency" value={row.currency} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Items</h3>
          {!loading && lines.length > 0 && (
            <span className="text-xs text-gray-400">
              {lines.length} line{lines.length === 1 ? '' : 's'} · {formatQty(totalQty)} qty
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lines.length === 0 ? (
          // Expected, not an error: a document that exists only in the AR/AP
          // ledger posts to accounts and has no item lines to show.
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm px-5 text-center">
            No item lines — this document posts to the ledger only
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Item Code</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Location</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Qty</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Unit Price</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lines.map((line) => (
                  <tr key={line.seq}>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{line.item_code || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{line.description || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{line.location || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                      {formatQty(line.qty)}{line.uom ? ` ${line.uom}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                      {formatMoney(line.unit_price, line.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {formatMoney(line.amount, line.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DetailOverlay>
  )
}
