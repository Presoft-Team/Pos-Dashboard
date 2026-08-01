'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Download } from 'lucide-react'
import Modal from '@/components/modal'
import { Filters, FilterOptions } from '@/types'
import {
  ExportColumn,
  ExportTableView,
  buildPdf,
  captureReactNode,
  formatFilterSummary,
  PDF_CAPTURE_WIDTH,
} from '@/lib/export'

export interface ExportChartSpec {
  id: string
  label: string
  // Re-renders the chart/KPI widget off-screen at a fixed width so the
  // capture is consistent regardless of the exporting device's viewport.
  render: () => ReactNode
}

export interface ExportTableSpec {
  id: string
  label: string
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
}

interface Props {
  open: boolean
  onClose: () => void
  pageTitle: string
  filters: Filters
  options?: FilterOptions
  charts?: ExportChartSpec[]
  tables?: ExportTableSpec[]
}

// PDF-only export (Excel removed) — captures a snapshot of each selected
// chart/table into one PDF.
export default function ExportModal({ open, onClose, pageTitle, filters, options, charts = [], tables = [] }: Props) {
  const [selectedCharts, setSelectedCharts] = useState<Set<string>>(new Set())
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set())
  const [columnSelections, setColumnSelections] = useState<Record<string, Set<string>>>({})
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  function toggleChart(id: string) {
    setSelectedCharts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function columnsFor(tableId: string, allColumns: ExportColumn[]) {
    return columnSelections[tableId] ?? new Set(allColumns.map((c) => c.key))
  }

  function toggleTable(id: string, allColumns: ExportColumn[]) {
    setSelectedTables((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        setColumnSelections((cs) => (cs[id] ? cs : { ...cs, [id]: new Set(allColumns.map((c) => c.key)) }))
      }
      return next
    })
  }

  function toggleColumn(tableId: string, key: string, allColumns: ExportColumn[]) {
    setColumnSelections((prev) => {
      const current = new Set(columnsFor(tableId, allColumns))
      if (current.has(key)) current.delete(key)
      else current.add(key)
      return { ...prev, [tableId]: current }
    })
  }

  const nothingSelected = selectedCharts.size === 0 && selectedTables.size === 0

  async function handleExport() {
    setExporting(true)
    setError('')
    const filterSummary = formatFilterSummary(filters, options)
    const baseFilename = pageTitle.replace(/\s+/g, '-')

    try {
      const sections: { label: string; canvas: HTMLCanvasElement }[] = []

      for (const chart of charts) {
        if (!selectedCharts.has(chart.id)) continue
        const canvas = await captureReactNode(chart.render(), PDF_CAPTURE_WIDTH)
        sections.push({ label: chart.label, canvas })
      }

      for (const table of tables) {
        if (!selectedTables.has(table.id)) continue
        const chosenKeys = columnsFor(table.id, table.columns)
        const cols = table.columns.filter((c) => chosenKeys.has(c.key))
        const rows = table.rows.slice(0, 20)
        const canvas = await captureReactNode(
          <ExportTableView title={table.label} columns={cols} rows={rows} />,
          PDF_CAPTURE_WIDTH
        )
        sections.push({ label: table.label, canvas })
      }

      if (sections.length === 0) {
        setError('Select at least one item to export.')
        setExporting(false)
        return
      }

      buildPdf(sections, filterSummary, pageTitle, `${baseFilename}.pdf`)

      setExporting(false)
      onClose()
    } catch (err) {
      console.error('Export failed:', err)
      setError('Export failed. Please try again.')
      setExporting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Export ${pageTitle}`}>
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Captures a snapshot of each selected item into a PDF (tables capped at 20 rows).
        </p>

        {charts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Charts &amp; Summary</p>
            {charts.map((chart) => (
              <label key={chart.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedCharts.has(chart.id)}
                  onChange={() => toggleChart(chart.id)}
                  className="rounded border-gray-300 text-brand focus:ring-brand"
                />
                {chart.label}
              </label>
            ))}
          </div>
        )}

        {tables.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tables</p>
            {tables.map((table) => (
              <div key={table.id} className="border border-gray-200 rounded-lg p-2.5">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedTables.has(table.id)}
                    onChange={() => toggleTable(table.id, table.columns)}
                    className="rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  {table.label}
                </label>
                {selectedTables.has(table.id) && (
                  <div className="mt-2 pt-2 border-t border-gray-100 pl-6 flex flex-wrap gap-x-3 gap-y-1">
                    {table.columns.map((c) => (
                      <label key={c.key} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={columnsFor(table.id, table.columns).has(c.key)}
                          onChange={() => toggleColumn(table.id, c.key, table.columns)}
                          className="rounded border-gray-300 text-brand focus:ring-brand"
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || nothingSelected}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-ink text-sm font-medium rounded-lg transition-colors"
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
