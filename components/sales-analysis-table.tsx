'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { SalesAnalysisRow } from '@/types'
import { formatMoney, formatQty } from '@/lib/currency'
import { ANALYSIS_COLUMN_FIELDS, AnalysisColumnKey, ANALYSIS_MEASURE_FIELDS, AnalysisMeasureKey } from '@/lib/sales-analysis'

interface Props {
  rows: SalesAnalysisRow[]
  columns: AnalysisColumnKey[]
  measures: AnalysisMeasureKey[]
  loading?: boolean
}

interface InnerGroup {
  key: string
  values: string[]
  rows: SalesAnalysisRow[]
}

// One outer group per distinct value of the FIRST selected column — matches
// AutoCount's own pivot grid, which breaks and subtotals on the outermost
// field first. Each outer group holds every inner (full-combination) group
// that shares that first value, plus a subtotal row summing all of them.
interface OuterGroup {
  key: string
  inner: InnerGroup[]
  rows: SalesAnalysisRow[]
}

const INITIAL_VISIBLE = 10
const SHOW_MORE_STEP = 10

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function innerGroups(rows: SalesAnalysisRow[], columns: AnalysisColumnKey[]): InnerGroup[] {
  if (columns.length === 0) {
    return rows.length === 0 ? [] : [{ key: '__all__', values: [], rows }]
  }
  const groups = new Map<string, InnerGroup>()
  for (const row of rows) {
    const values = columns.map((c) => String(row[c] ?? ''))
    const key = values.join('')
    let g = groups.get(key)
    if (!g) {
      g = { key, values, rows: [] }
      groups.set(key, g)
    }
    g.rows.push(row)
  }
  return [...groups.values()]
}

// Buckets the inner groups by their first column's value. With 0 or 1
// columns selected there's nothing further to nest — each inner group is
// its own outer group and no subtotal row is shown, since it would just
// repeat the one row above it.
function outerGroups(groups: InnerGroup[], hasOuter: boolean, dir: 'asc' | 'desc'): OuterGroup[] {
  const sign = dir === 'desc' ? -1 : 1
  if (!hasOuter) {
    return [...groups]
      .sort((a, b) => sign * collator.compare(a.values[0] ?? '', b.values[0] ?? ''))
      .map((g) => ({ key: g.key, inner: [g], rows: g.rows }))
  }
  const map = new Map<string, OuterGroup>()
  for (const g of groups) {
    const key = g.values[0] ?? ''
    let og = map.get(key)
    if (!og) {
      og = { key, inner: [], rows: [] }
      map.set(key, og)
    }
    og.inner.push(g)
    og.rows.push(...g.rows)
  }
  const list = [...map.values()]
  for (const og of list) {
    og.inner.sort((a, b) => sign * collator.compare(a.values.slice(1).join(''), b.values.slice(1).join('')))
  }
  list.sort((a, b) => sign * collator.compare(a.key, b.key))
  return list
}

function sumOf(rows: SalesAnalysisRow[], key: AnalysisMeasureKey): number {
  if (key === 'profit_margin') {
    const subTotal = rows.reduce((n, r) => n + (r.local_sub_total || 0), 0)
    const profit = rows.reduce((n, r) => n + (r.local_profit || 0), 0)
    return subTotal === 0 ? 0 : profit / subTotal
  }
  return rows.reduce((n, r) => n + (Number(r[key]) || 0), 0)
}

function formatMeasure(key: AnalysisMeasureKey, value: number, currency: string): string {
  if (key === 'profit_margin') return `${(value * 100).toFixed(1)}%`
  if (key === 'qty' || key === 'smallest_qty' || key === 'foc_qty') return formatQty(value)
  return formatMoney(value, currency)
}

// Results grid for the Multi Dimension Sales Analysis panel — grouped and
// subtotaled by the first selected column (matching AutoCount's own pivot
// grid, which breaks on the outermost field first), sorted by that same
// column, and paginated by outer group rather than by raw row so "Show 10
// more" always reveals whole groups, never half of one.
export default function SalesAnalysisTable({ rows, columns, measures, loading }: Props) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  // Collapsed by default — a report with many groups otherwise dumps every
  // line at once. Keyed by outer group key; only entries present are open.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const hasOuter = columns.length > 1
  const groups = useMemo(() => innerGroups(rows, columns), [rows, columns])
  const outer = useMemo(() => outerGroups(groups, hasOuter, sortDir), [groups, hasOuter, sortDir])
  const currency = rows[0]?.currency ?? ''

  // A different report (new columns/rows) or a flipped sort makes the old
  // "showing 30 of 80" position (and whichever groups were expanded)
  // meaningless against the new list.
  useEffect(() => { setVisibleCount(INITIAL_VISIBLE); setExpanded(new Set()) }, [rows, columns, sortDir])

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const visibleOuter = outer.slice(0, visibleCount)
  const hasMore = visibleCount < outer.length
  const isExpanded = visibleCount > INITIAL_VISIBLE

  const grandTotals = useMemo(
    () => measures.map((m) => ({ key: m, value: sumOf(rows, m) })),
    [rows, measures]
  )

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Multi Dimension Sales Analysis</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {columns.length === 0
              ? 'Grouped as one total — add columns for a breakdown.'
              : `Grouped by ${columns.map((c) => ANALYSIS_COLUMN_FIELDS.find((f) => f.key === c)?.label ?? c).join(' → ')}`}
          </p>
        </div>
        {columns.length > 0 && (
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 gap-0.5 shrink-0">
            {(['asc', 'desc'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSortDir(d)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  sortDir === d ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {d === 'asc' ? 'Normal' : 'Desc'}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No lines found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {columns.map((c) => (
                  <th key={c} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {ANALYSIS_COLUMN_FIELDS.find((f) => f.key === c)?.label ?? c}
                  </th>
                ))}
                {measures.map((m) => (
                  <th key={m} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right whitespace-nowrap">
                    {ANALYSIS_MEASURE_FIELDS.find((f) => f.key === m)?.label ?? m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleOuter.map((og) => {
                const isOpen = !hasOuter || expanded.has(og.key)
                return (
                  <Fragment key={og.key}>
                    {hasOuter && isOpen && og.inner.map((ig, i) => (
                      <tr key={ig.key}>
                        {i === 0 && (
                          <td
                            rowSpan={og.inner.length}
                            className="px-4 py-3 text-gray-900 font-medium align-top whitespace-nowrap border-r border-gray-50"
                          >
                            {og.key || '—'}
                          </td>
                        )}
                        {ig.values.slice(1).map((v, vi) => (
                          <td key={vi} className="px-4 py-3 text-gray-700 whitespace-nowrap">{v || '—'}</td>
                        ))}
                        {measures.map((m) => (
                          <td key={m} className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                            {formatMeasure(m, sumOf(ig.rows, m), currency)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!hasOuter && og.inner.map((ig) => (
                      <tr key={ig.key}>
                        {ig.values.map((v, vi) => (
                          <td key={vi} className="px-4 py-3 text-gray-700 whitespace-nowrap">{v || '—'}</td>
                        ))}
                        {measures.map((m) => (
                          <td key={m} className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                            {formatMeasure(m, sumOf(ig.rows, m), currency)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {hasOuter && (
                      <tr
                        key={`${og.key}-total`}
                        onClick={() => toggle(og.key)}
                        className="bg-gray-50 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <td colSpan={columns.length} className="px-4 py-3 text-gray-900">
                          <span className="inline-flex items-center gap-1.5">
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {og.key || '—'} Total
                          </span>
                        </td>
                        {measures.map((m) => (
                          <td key={m} className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">
                            {formatMeasure(m, sumOf(og.rows, m), currency)}
                          </td>
                        ))}
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                <td className="px-4 py-3 text-gray-900" colSpan={Math.max(columns.length, 1)}>Grand Total</td>
                {grandTotals.map((t) => (
                  <td key={t.key} className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">
                    {formatMeasure(t.key, t.value, currency)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && rows.length > 0 && (hasMore || isExpanded) && (
        <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-gray-100">
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => Math.min(c + SHOW_MORE_STEP, outer.length))}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show 10 more
            </button>
          )}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(outer.length)}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show all
            </button>
          )}
          {isExpanded && (
            <button
              onClick={() => setVisibleCount(INITIAL_VISIBLE)}
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
