'use client'

import { useState } from 'react'
import { LayoutGrid, SlidersHorizontal, X } from 'lucide-react'
import DetailOverlay from '@/components/detail-overlay'
import SalesFilterFields, {
  salesFilterActiveCount, SalesFilterOptions, SalesFilterState,
} from '@/components/sales-filter-fields'
import {
  ANALYSIS_COLUMN_FIELDS, ANALYSIS_DOC_TYPE_OPTIONS, ANALYSIS_MEASURE_FIELDS,
  AnalysisColumnKey, AnalysisMeasureKey,
} from '@/lib/sales-analysis'

type Tab = 'columns' | 'options' | 'filter'

interface Props {
  // Filter tab — same field set SalesFilterPanel renders standalone.
  filterValue: SalesFilterState
  onFilterChange: (next: SalesFilterState) => void
  filterOptions: SalesFilterOptions
  unattributed?: { checked: boolean; onChange: (checked: boolean) => void; label: string }[]
  // Columns tab — which dimensions to group by, and in what order.
  columns: AnalysisColumnKey[]
  onColumnsChange: (next: AnalysisColumnKey[]) => void
  // Options tab.
  docTypes: string[]
  onDocTypesChange: (next: string[]) => void
  measures: AnalysisMeasureKey[]
  onMeasuresChange: (next: AnalysisMeasureKey[]) => void
  // Runs the report with whatever's currently configured, and closes.
  onApply: () => void
}

// Drag payload — JSON-encoded onto the native HTML5 dataTransfer channel.
// `from: 'available'` means "add it"; `from: 'selected'` carries the index
// being moved, for in-place reordering.
interface DragPayload {
  key: AnalysisColumnKey
  from: 'available' | 'selected'
  index?: number
}

function readPayload(e: React.DragEvent): DragPayload | null {
  try {
    return JSON.parse(e.dataTransfer.getData('text/plain')) as DragPayload
  } catch {
    return null
  }
}

// Unified "Multi Dimension Sales Analysis" overlay — Columns (drag fields in
// to build the report's grouping), Options (which documents count, which
// totals show), and Filter (the same field set as SalesFilterPanel). Both
// trigger buttons below open the same overlay instance, landing on whichever
// tab makes sense for that button, so switching tabs inside never feels like
// a different screen.
export default function SalesAnalysisPanel({
  filterValue, onFilterChange, filterOptions, unattributed,
  columns, onColumnsChange, docTypes, onDocTypesChange, measures, onMeasuresChange, onApply,
}: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('columns')

  const activeFilterCount = salesFilterActiveCount(filterValue)
  const available = ANALYSIS_COLUMN_FIELDS.filter((f) => !columns.includes(f.key))

  function openOn(t: Tab) {
    setTab(t)
    setOpen(true)
  }

  function addColumn(key: AnalysisColumnKey, atIndex?: number) {
    if (columns.includes(key)) return
    const next = [...columns]
    next.splice(atIndex ?? next.length, 0, key)
    onColumnsChange(next)
  }

  function removeColumn(key: AnalysisColumnKey) {
    onColumnsChange(columns.filter((k) => k !== key))
  }

  function moveColumn(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const next = [...columns]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved)
    onColumnsChange(next)
  }

  function toggleDocType(key: string) {
    onDocTypesChange(docTypes.includes(key) ? docTypes.filter((k) => k !== key) : [...docTypes, key])
  }

  function toggleMeasure(key: AnalysisMeasureKey) {
    onMeasuresChange(measures.includes(key) ? measures.filter((k) => k !== key) : [...measures, key])
  }

  function onSelectedZoneDrop(e: React.DragEvent) {
    e.preventDefault()
    const payload = readPayload(e)
    if (!payload || payload.from !== 'available') return
    addColumn(payload.key)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => openOn('columns')}
        className="h-9 flex items-center justify-center gap-1.5 px-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap w-full sm:w-auto shrink-0"
      >
        <LayoutGrid size={15} />
        Multi Dimension Sales Analysis
      </button>
      <button
        type="button"
        onClick={() => openOn('filter')}
        className="h-9 w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors whitespace-nowrap"
      >
        <SlidersHorizontal size={15} />
        Filters
        {activeFilterCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-brand text-white text-[11px] leading-none">
            {activeFilterCount}
          </span>
        )}
      </button>

      <DetailOverlay open={open} onClose={() => setOpen(false)} title="Multi Dimension Sales Analysis">
        {/* Tab bar — same 3 tabs however the overlay was opened. */}
        <div className="flex gap-1 border-b border-gray-200">
          {([
            { key: 'columns', label: 'Columns' },
            { key: 'options', label: 'Options' },
            { key: 'filter', label: 'Filter' },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'columns' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Click a field to add it, or drag it into Selected Columns. Drag within Selected Columns to reorder.
            </p>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
              <h3 className="text-xs font-medium text-gray-500 mb-3">Available Fields</h3>
              <div className="flex flex-wrap gap-2">
                {available.length === 0 && <p className="text-sm text-gray-400">All fields added.</p>}
                {available.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ key: f.key, from: 'available' } satisfies DragPayload))}
                    onClick={() => addColumn(f.key)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors cursor-grab active:cursor-grabbing"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onSelectedZoneDrop}
              className="bg-white rounded-xl border-2 border-dashed border-gray-200 px-5 py-4 min-h-[88px]"
            >
              <h3 className="text-xs font-medium text-gray-500 mb-3">Selected Columns</h3>
              {columns.length === 0 ? (
                <p className="text-sm text-gray-400">Drop fields here to group the report by them, in order.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {columns.map((key, i) => {
                    const field = ANALYSIS_COLUMN_FIELDS.find((f) => f.key === key)
                    return (
                      <div
                        key={key}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ key, from: 'selected', index: i } satisfies DragPayload))}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const payload = readPayload(e)
                          if (!payload) return
                          if (payload.from === 'available') addColumn(payload.key, i)
                          else if (payload.index !== undefined) moveColumn(payload.index, i)
                        }}
                        className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg bg-brand/10 border border-brand/30 text-sm text-gray-900 cursor-grab active:cursor-grabbing"
                      >
                        <span className="text-gray-400 text-xs font-medium">{i + 1}</span>
                        {field?.label ?? key}
                        <button
                          type="button"
                          onClick={() => removeColumn(key)}
                          aria-label={`Remove ${field?.label ?? key}`}
                          className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-white"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'options' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
              <h3 className="text-xs font-medium text-gray-500 mb-3">Document Options</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {ANALYSIS_DOC_TYPE_OPTIONS.map((d) => (
                  <label
                    key={d.key}
                    className={`flex items-center gap-2 text-sm select-none ${
                      d.available ? 'text-gray-700 cursor-pointer' : 'text-gray-300 cursor-not-allowed'
                    }`}
                    title={d.available ? undefined : 'Not available yet — non-committed documents aren’t wired up'}
                  >
                    <input
                      type="checkbox"
                      disabled={!d.available}
                      checked={d.available && docTypes.includes(d.key)}
                      onChange={() => toggleDocType(d.key)}
                      className="rounded border-gray-300 text-brand focus:ring-brand disabled:opacity-50"
                    />
                    Include {d.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
              <h3 className="text-xs font-medium text-gray-500 mb-3">Data Area Options</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {ANALYSIS_MEASURE_FIELDS.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={measures.includes(m.key)}
                      onChange={() => toggleMeasure(m.key)}
                      className="rounded border-gray-300 text-brand focus:ring-brand"
                    />
                    Show {m.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'filter' && (
          <>
            {activeFilterCount > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onFilterChange({})}
                  className="text-sm font-medium text-brand hover:text-brand/80"
                >
                  Clear all
                </button>
              </div>
            )}
            <SalesFilterFields value={filterValue} onChange={onFilterChange} options={filterOptions} unattributed={unattributed} />
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              onApply()
              setOpen(false)
            }}
            className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
          >
            Apply
          </button>
        </div>
      </DetailOverlay>
    </>
  )
}
