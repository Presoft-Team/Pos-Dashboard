'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { CreditPaidInvoiceRow, RevenueJoinIntegrityRow } from '@/types'
import { formatMoney } from '@/lib/currency'

// Ad-hoc verification page — not linked from nav. No search: browse the
// most recent 50 invoices. With search: look up any invoice by DocNo
// (substring match), straight off SQL Server via /api/test/credit-paid.
// Safe to delete this whole route + app/api/test once verified.
export default function TestPage() {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<CreditPaidInvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [joinRows, setJoinRows] = useState<RevenueJoinIntegrityRow[]>([])
  const [joinLoading, setJoinLoading] = useState(true)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
    fetch(`/api/test/credit-paid${qs}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          setError(data.error)
        } else {
          setRows(data)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Fetch failed'))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => {
    setJoinLoading(true)
    setJoinError(null)
    fetch('/api/test/join-integrity')
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          setJoinError(data.error)
        } else {
          setJoinRows(data)
        }
      })
      .catch((err) => setJoinError(err instanceof Error ? err.message : 'Fetch failed'))
      .finally(() => setJoinLoading(false))
  }, [])

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 lg:p-5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Test Query — Revenue Join Integrity
        </p>

        {joinLoading && <p className="text-sm text-gray-400">Loading…</p>}
        {joinError && <p className="text-sm text-danger">{joinError}</p>}

        {!joinLoading && !joinError && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Check</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Orphan Count</th>
                </tr>
              </thead>
              <tbody>
                {joinRows.map((r) => (
                  <tr key={r.check_name} className="border-t border-gray-100">
                    <td className="px-3 py-2">{r.check_name}</td>
                    <td className={`px-3 py-2 text-right font-medium ${r.orphan_count > 0 ? 'text-danger' : 'text-gray-400'}`}>
                      {r.orphan_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 lg:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Test Query — Credit Invoices
          </p>
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Doc No (e.g. INV 2601/171)"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>

        {loading && <p className="text-sm text-gray-400">Loading…</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Doc No</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Debtor</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Branch</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Outstanding</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.doc_no} className="border-t border-gray-100">
                    <td className="px-3 py-2">{r.doc_no}</td>
                    <td className="px-3 py-2">{r.order_date?.slice(0, 10)}</td>
                    <td className="px-3 py-2">{r.debtor_id}</td>
                    <td className="px-3 py-2">{r.branch_id}</td>
                    <td className="px-3 py-2">{r.due_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(r.outstanding, r.currency)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(r.revenue, r.currency)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-400">No invoices found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
