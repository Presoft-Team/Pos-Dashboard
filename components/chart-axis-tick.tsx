'use client'

// Shared x-axis label staggering, used by every chart with a category axis
// (bar-chart, monthly-trend-chart). Every label stays
// visible — none are ever hidden. Row count is chosen by actually measuring:
// try 1 row, and only add a row if some label wouldn't fit its slot at that
// row count. Never more than MAX_ROWS. If even MAX_ROWS rows can't fit
// everyone, the leftover-too-long labels get truncated with an ellipsis
// rather than left to overlap their neighbor.
const MAX_ROWS = 3

let measureCanvas: HTMLCanvasElement | null = null
function measureTextWidth(text: string, fontSize = 12): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.6
  measureCanvas ??= document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return text.length * fontSize * 0.6
  ctx.font = `${fontSize}px Arial, sans-serif`
  return ctx.measureText(text).width
}

// Same-row neighbors sit `rows` category-bands apart, so the width available
// to any one label before it reaches its neighbor is (containerWidth / count)
// * rows. Picks the fewest rows (1..MAX_ROWS) where every label already fits
// that slot untruncated; falls back to MAX_ROWS if none of them do.
export function chooseRows(names: string[], containerWidth: number): number {
  if (!containerWidth || names.length === 0) return 1
  const slotWidth = (rows: number) => (containerWidth / names.length) * rows * 0.9
  for (let rows = 1; rows <= MAX_ROWS; rows++) {
    if (names.every((n) => measureTextWidth(n) <= slotWidth(rows))) return rows
  }
  return MAX_ROWS
}

function truncateToWidth(text: string, maxWidth: number, fontSize = 12): string {
  if (!maxWidth || maxWidth <= 0 || measureTextWidth(text, fontSize) <= maxWidth) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measureTextWidth(text.slice(0, mid) + '…', fontSize) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo > 0 ? text.slice(0, lo) + '…' : text.slice(0, 1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function StaggeredTick({ x, y, payload, index, rows, slotWidth }: any) {
  const row = index % rows
  const label = truncateToWidth(String(payload.value), slotWidth)
  return (
    <text x={x} y={y + 12 + row * 14} textAnchor="middle" fill="#94a3b8" fontSize={12}>
      {label}
    </text>
  )
}

export function fmtInt(value: number) {
  return new Intl.NumberFormat('en-MY').format(Math.round(value))
}

export function formatK(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(Math.round(value))
}
