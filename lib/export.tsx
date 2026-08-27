'use client'

import type { ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
// The vanilla html2canvas package can't parse the oklch()/lab() color
// functions Tailwind CSS v4 generates by default for its palette — every
// capture would throw "unsupported color function". html2canvas-pro is a
// maintained fork that adds support for those, drop-in API-compatible.
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'
import { Filters, FilterOptions, EntityOption } from '@/types'
import { formatAmount } from '@/lib/currency'

// Portrait PDF pages are taller than wide, so capturing at full desktop width
// (~1280px) produces a landscape-shaped image that wastes most of the page.
// iPad Mini's portrait width is a much better match for a portrait PDF.
export const PDF_CAPTURE_WIDTH = 768

export interface ExportColumn {
  key: string
  label: string
  align?: 'left' | 'right'
  // Formats the raw value for the PDF's image (currency symbol, thousands
  // separators, etc). Excel always gets the untouched row[key] value instead,
  // so numeric columns stay numeric and usable in a spreadsheet.
  formatForPdf?: (row: Record<string, unknown>) => string
}

function nameOf(options: EntityOption[] | undefined, id: string): string {
  return options?.find((o) => o.id === id)?.name ?? id
}

export function formatFilterSummary(filters: Filters, options?: FilterOptions): string {
  const parts: string[] = []
  parts.push(
    filters.date_from || filters.date_to
      ? `Date: ${filters.date_from || 'earliest'} to ${filters.date_to || 'latest'}`
      : 'Date: All'
  )
  parts.push(`Item: ${filters.item ? nameOf(options?.items, filters.item) : 'All'}`)
  parts.push(`Sales Agent: ${filters.sales_agent ? nameOf(options?.sales_agents, filters.sales_agent) : 'All'}`)
  parts.push(`Debtor: ${filters.debtor ? nameOf(options?.debtors, filters.debtor) : 'All'}`)
  parts.push(`Creditor: ${filters.creditor ? nameOf(options?.creditors, filters.creditor) : 'All'}`)
  parts.push(`Item Group: ${filters.item_group || 'All'}`)
  parts.push(`Item Type: ${filters.item_type || 'All'}`)
  return parts.join('   |   ')
}

function fmtInt(n: unknown) {
  return new Intl.NumberFormat('en-MY').format(Number(n ?? 0))
}

// Shared column set for every entity-revenue table — Sales Dashboard's Best
// Sellers, and Performance's 4 breakdown tables. The API's cash/credit split
// is summed into one Qty and one Revenue column, matching what the on-screen
// tables show. nameKey/nameLabel let each caller supply its own first column
// (bucket_name for Best Sellers, name for Performance's 4 dimensions).
export function entityRevenueColumns(nameKey: string, nameLabel: string): ExportColumn[] {
  return [
    { key: nameKey, label: nameLabel },
    { key: 'currency', label: 'Currency' },
    { key: 'qty', label: 'Qty', align: 'right', formatForPdf: (r) => fmtInt(Number(r.credit_qty ?? 0) + Number(r.cash_qty ?? 0)) },
    { key: 'revenue', label: 'Revenue', align: 'right', formatForPdf: (r) => formatAmount(Number(r.credit_revenue ?? 0) + Number(r.cash_revenue ?? 0)) },
  ]
}

// Purchase-side twin of entityRevenueColumns — credit_purchase/cash_purchase,
// not credit_revenue/cash_revenue (this is spend, not revenue).
export function entityPurchaseColumns(nameKey: string, nameLabel: string): ExportColumn[] {
  return [
    { key: nameKey, label: nameLabel },
    { key: 'currency', label: 'Currency' },
    { key: 'qty', label: 'Qty', align: 'right', formatForPdf: (r) => fmtInt(Number(r.credit_qty ?? 0) + Number(r.cash_qty ?? 0)) },
    { key: 'purchase', label: 'Purchase', align: 'right', formatForPdf: (r) => formatAmount(Number(r.credit_purchase ?? 0) + Number(r.cash_purchase ?? 0)) },
  ]
}

// --- Off-screen rendering, for capturing charts/KPI cards/export-only table
// markup at a fixed width regardless of the real device's viewport. Recharts'
// ResponsiveContainer measures its actual DOM container via ResizeObserver, so
// simply screenshotting the live on-page chart would capture it at whatever
// size the visitor's real screen happens to render it — mounting a fresh copy
// in a hidden, fixed-width container sidesteps that entirely.

function mountOffscreen(node: ReactNode, width: number): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '-99999px'
  container.style.width = `${width}px`
  container.style.background = '#ffffff'
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(node)
  return { container, root }
}

function unmountOffscreen(container: HTMLDivElement, root: Root) {
  root.unmount()
  container.remove()
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Renders `node` off-screen at `width`, waits a beat for layout/paint (and any
// chart entrance animation) to settle, captures it, then tears the hidden
// render down again.
export async function captureReactNode(node: ReactNode, width = PDF_CAPTURE_WIDTH): Promise<HTMLCanvasElement> {
  const { container, root } = mountOffscreen(node, width)
  try {
    await wait(500)
    return await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      windowWidth: width,
    })
  } finally {
    unmountOffscreen(container, root)
  }
}

// Plain (non-interactive) table markup purpose-built for PDF capture — takes
// only the caller-selected columns and rows, so a wide table (e.g. Order
// Detail's ~17 columns) can be trimmed down to whatever actually fits a
// portrait page instead of being captured at its full, overflowing width.
export function ExportTableView({
  title,
  columns,
  rows,
}: {
  title: string
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
}) {
  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', padding: 16, background: '#fff', width: '100%' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 10px' }}>{title}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align ?? 'left',
                  borderBottom: '2px solid #e5e7eb',
                  padding: '6px 8px',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  fontSize: 9,
                  letterSpacing: 0.3,
                  whiteSpace: 'nowrap',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{ textAlign: c.align ?? 'left', padding: '6px 8px', color: '#111827', whiteSpace: 'nowrap' }}
                >
                  {c.formatForPdf ? c.formatForPdf(row) : String(row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- PDF assembly ------------------------------------------------------

export interface PdfSection {
  label: string
  canvas: HTMLCanvasElement
}

export function buildPdf(sections: PdfSection[], filterSummary: string, pageTitle: string, filename: string) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12

  sections.forEach((section, i) => {
    if (i > 0) pdf.addPage()
    let cursorY = margin

    pdf.setFontSize(14)
    pdf.setTextColor(20, 20, 20)
    pdf.text(pageTitle, margin, cursorY)
    cursorY += 6

    pdf.setFontSize(8)
    pdf.setTextColor(120, 120, 120)
    const filterLines = pdf.splitTextToSize(filterSummary, pageWidth - margin * 2) as string[]
    pdf.text(filterLines, margin, cursorY)
    cursorY += filterLines.length * 3.5 + 5

    pdf.setFontSize(11)
    pdf.setTextColor(20, 20, 20)
    pdf.text(section.label, margin, cursorY)
    cursorY += 5

    const imgWidth = pageWidth - margin * 2
    const imgHeight = (section.canvas.height / section.canvas.width) * imgWidth
    const maxImgHeight = pageHeight - cursorY - margin

    let finalWidth = imgWidth
    let finalHeight = imgHeight
    if (imgHeight > maxImgHeight) {
      const scale = maxImgHeight / imgHeight
      finalHeight = maxImgHeight
      finalWidth = imgWidth * scale
    }

    const imgData = section.canvas.toDataURL('image/png')
    pdf.addImage(imgData, 'PNG', margin, cursorY, finalWidth, finalHeight)
  })

  pdf.save(filename)
}
