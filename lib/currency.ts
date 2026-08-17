export interface CurrencyDef {
  code: string
  symbol: string
  label: string
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'MYR', symbol: 'RM', label: 'Malaysian Ringgit' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan' },
  { code: 'IDR', symbol: 'Rp', label: 'Indonesian Rupiah' },
  { code: 'THB', symbol: '฿', label: 'Thai Baht' },
]

export const DEFAULT_CURRENCY = 'MYR'

export function currencySymbol(code: string | null | undefined): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code ?? CURRENCIES[0].symbol
}

// Plain 2-decimal amount, no currency symbol — for table cells whose column
// header already states the currency (e.g. "Revenue (RM)").
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatMoney(amount: number, code: string | null | undefined): string {
  return `${currencySymbol(code)} ${formatAmount(amount)}`
}

// Renders a per-currency breakdown as separate lines, e.g. ["USD 70.00", "RM 50.00"],
// for aggregates that span more than one currency (no FX conversion — each
// currency's raw sum is shown on its own line).
export function formatMoneyLines(totals: { currency: string; amount: number }[]): string[] {
  if (totals.length === 0) return [formatMoney(0, DEFAULT_CURRENCY)]
  return totals.map((t) => formatMoney(t.amount, t.currency))
}

export interface CurrencyBreakdown {
  currency: string
  revenue: number
  qty: number
}

export interface CurrencyPivotRow {
  name: string
  // Raw sum of revenue across every currency this entity sold in. This is a
  // magnitude only (no FX conversion — adding MYR and USD together isn't a
  // real number), used purely for a single bar/line's height and for ranking.
  // The real, currency-correct numbers live in `breakdown`, for the tooltip.
  total: number
  breakdown: CurrencyBreakdown[]
}

// Pivots (entity, currency, revenue, qty) rows into one row per entity — one
// bar/line per entity instead of one per (entity, currency) pair — while
// keeping each currency's actual revenue and qty in `breakdown` so a tooltip
// can still show "USD: $300 · Qty 40" / "MYR: RM200 · Qty 15" separately.
// `foldOther`: when the row count exceeds `limit`, fold the remainder into a
// trailing "Other" bucket instead of silently dropping them (Dashboard's
// "Top 5 + Other" chart); Performance's charts leave this off and just cut
// at `limit`.
export function pivotRevenueByCurrency<T extends { currency: string; total_revenue: number; total_qty: number }>(
  rows: T[],
  nameOf: (row: T) => string,
  limit?: number,
  foldOther = false
): CurrencyPivotRow[] {
  const map = new Map<string, CurrencyPivotRow>()
  for (const row of rows) {
    const name = nameOf(row)
    const entry = map.get(name) ?? { name, total: 0, breakdown: [] }
    entry.total += row.total_revenue
    entry.breakdown.push({ currency: row.currency, revenue: row.total_revenue, qty: row.total_qty })
    map.set(name, entry)
  }
  let data = [...map.values()].sort((a, b) => b.total - a.total)
  if (limit && data.length > limit) {
    const top = data.slice(0, limit)
    const rest = data.slice(limit)
    if (!foldOther) {
      data = top
    } else {
      const other: CurrencyPivotRow = { name: 'Other', total: 0, breakdown: [] }
      const byCurrency = new Map<string, CurrencyBreakdown>()
      for (const row of rest) {
        other.total += row.total
        for (const b of row.breakdown) {
          const entry = byCurrency.get(b.currency) ?? { currency: b.currency, revenue: 0, qty: 0 }
          entry.revenue += b.revenue
          entry.qty += b.qty
          byCurrency.set(b.currency, entry)
        }
      }
      other.breakdown = [...byCurrency.values()]
      data = [...top, other]
    }
  }
  return data
}

export const CHART_PALETTE = ['#F2AA24', '#5B8DEF', '#00D697', '#E85D75', '#9B59B6', '#F39C12']

// Cash/Credit colors, shared by every Cash/Credit chart (Monthly trend).
export const CASH_CREDIT_COLORS = {
  cash: '#F2AA24',
  credit: '#5B8DEF',
}

export interface CashCreditBreakdown {
  currency: string
  cash: number
  credit: number
}

export interface CashCreditPivotRow {
  name: string
  // Magnitudes only (summed across currencies, no FX conversion) — used for
  // line height. Real per-currency numbers live in `breakdown`, for the
  // tooltip.
  cash: number
  credit: number
  total: number
  breakdown: CashCreditBreakdown[]
}

interface CashCreditRevenueRow {
  currency: string
  cash_revenue: number
  credit_revenue: number
}

// Cash/Credit pivot, chronological (by year/month) rather than ranked by
// magnitude — for the Monthly Sales trend chart, which needs its months in
// order, not sorted by size.
//
// The API only returns rows for months that actually had sales — a month
// with $0 revenue is a missing row, not a zero row. Left as-is, that reads
// on the chart as "no data available" rather than "nothing sold," and the
// x-axis silently skips months. When dateFrom/dateTo are given, this fills
// every month in that range with a zeroed entry before overlaying the real
// rows, so gaps render as a flat 0 instead of vanishing.
export function pivotMonthlyTrend<T extends CashCreditRevenueRow & { year: number; month: number }>(
  rows: T[],
  monthNames: string[],
  dateFrom?: string | null,
  dateTo?: string | null
): CashCreditPivotRow[] {
  const byMonth = new Map<string, CashCreditPivotRow>()
  for (const row of rows) {
    const key = `${row.year}-${row.month}`
    const entry = byMonth.get(key) ?? { name: `${monthNames[row.month]} ${row.year}`, cash: 0, credit: 0, total: 0, breakdown: [] }
    entry.cash += row.cash_revenue
    entry.credit += row.credit_revenue
    entry.total += row.cash_revenue + row.credit_revenue
    entry.breakdown.push({ currency: row.currency, cash: row.cash_revenue, credit: row.credit_revenue })
    byMonth.set(key, entry)
  }

  let order: string[]
  if (dateFrom && dateTo) {
    order = []
    const [fy, fm] = dateFrom.split('-').map(Number)
    const [ty, tm] = dateTo.split('-').map(Number)
    let y = fy
    let m = fm
    while (y < ty || (y === ty && m <= tm)) {
      order.push(`${y}-${m}`)
      m += 1
      if (m > 12) { m = 1; y += 1 }
    }
  } else {
    // No range given (shouldn't happen in practice — every page sets a
    // default date range on load) — fall back to whichever months the data
    // itself contains, in first-seen order.
    order = [...byMonth.keys()]
  }

  return order.map((key) => {
    const existing = byMonth.get(key)
    if (existing) return existing
    const [y, m] = key.split('-').map(Number)
    return { name: `${monthNames[m]} ${y}`, cash: 0, credit: 0, total: 0, breakdown: [] }
  })
}
