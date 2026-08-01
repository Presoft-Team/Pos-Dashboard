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

// Recognized tokens (header words, cell values, symbols) mapped to a currency code.
export const CURRENCY_TOKENS: Record<string, string> = {
  MYR: 'MYR', RM: 'MYR', RINGGIT: 'MYR',
  USD: 'USD', 'US$': 'USD', USDOLLAR: 'USD',
  SGD: 'SGD', 'S$': 'SGD',
  EUR: 'EUR', EURO: 'EUR',
  GBP: 'GBP',
  CNY: 'CNY', RMB: 'CNY',
  IDR: 'IDR', RP: 'IDR',
  THB: 'THB',
}

export function tokenToCurrency(raw: string): string | null {
  const key = raw.trim().toUpperCase().replace(/\s+/g, '')
  return CURRENCY_TOKENS[key] ?? null
}

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
export function pivotRevenueByCurrency<T extends { currency: string; total_revenue: number; total_qty: number }>(
  rows: T[],
  nameOf: (row: T) => string,
  limit?: number
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
  if (limit) data = data.slice(0, limit)
  return data
}

export const CHART_PALETTE = ['#F2AA24', '#5B8DEF', '#00D697', '#E85D75', '#9B59B6', '#F39C12']

// Paid/Not-due/Overdue status colors, shared by every stacked/multi-line
// chart (Dashboard "Revenue by Item", Monthly trend) — see PLAN.md Section 4.
// Paid reuses the brand color; Overdue reuses the existing danger color;
// Not-due is a new neutral in between the two.
export const STATUS_COLORS = {
  paid: '#F2AA24',
  notDue: '#94A3B8',
  overdue: '#D90000',
}

export interface StatusBreakdown {
  currency: string
  paid: number
  notDue: number
  overdue: number
  qtyPaid: number
  qtyNotDue: number
  qtyOverdue: number
}

export interface StatusPivotRow {
  name: string
  // Magnitudes only (summed across currencies, no FX conversion) — used for
  // bar/line height and top-N ranking. Real per-currency numbers live in
  // `breakdown`, for the tooltip.
  paid: number
  notDue: number
  overdue: number
  total: number
  breakdown: StatusBreakdown[]
}

interface StatusRow {
  currency: string
  revenue_paid: number
  revenue_not_due: number
  revenue_overdue: number
  qty_paid: number
  qty_not_due: number
  qty_overdue: number
}

// Pivots (bucket, currency, paid/notDue/overdue) rows into one row per
// bucket (one bar per item/group/type instead of one per (bucket, currency)
// pair). When `limit` is given, keeps the top N buckets by total magnitude
// and folds everything else into a single "Other" bucket — used for the
// Dashboard/Performance "Top 5 + Other" charts (PLAN.md Section 4).
export function pivotItemRevenue<T extends StatusRow>(
  rows: T[],
  nameOf: (row: T) => string,
  limit?: number
): StatusPivotRow[] {
  const map = new Map<string, StatusPivotRow>()
  for (const row of rows) {
    const name = nameOf(row)
    const entry = map.get(name) ?? { name, paid: 0, notDue: 0, overdue: 0, total: 0, breakdown: [] }
    entry.paid += row.revenue_paid
    entry.notDue += row.revenue_not_due
    entry.overdue += row.revenue_overdue
    entry.total += row.revenue_paid + row.revenue_not_due + row.revenue_overdue
    entry.breakdown.push({
      currency: row.currency,
      paid: row.revenue_paid, notDue: row.revenue_not_due, overdue: row.revenue_overdue,
      qtyPaid: row.qty_paid, qtyNotDue: row.qty_not_due, qtyOverdue: row.qty_overdue,
    })
    map.set(name, entry)
  }
  let data = [...map.values()].sort((a, b) => b.total - a.total)
  if (limit && data.length > limit) {
    const top = data.slice(0, limit)
    const rest = data.slice(limit)
    const other: StatusPivotRow = { name: 'Other', paid: 0, notDue: 0, overdue: 0, total: 0, breakdown: [] }
    const byCurrency = new Map<string, StatusBreakdown>()
    for (const row of rest) {
      other.paid += row.paid
      other.notDue += row.notDue
      other.overdue += row.overdue
      other.total += row.total
      for (const b of row.breakdown) {
        const entry = byCurrency.get(b.currency) ?? { currency: b.currency, paid: 0, notDue: 0, overdue: 0, qtyPaid: 0, qtyNotDue: 0, qtyOverdue: 0 }
        entry.paid += b.paid; entry.notDue += b.notDue; entry.overdue += b.overdue
        entry.qtyPaid += b.qtyPaid; entry.qtyNotDue += b.qtyNotDue; entry.qtyOverdue += b.qtyOverdue
        byCurrency.set(b.currency, entry)
      }
    }
    other.breakdown = [...byCurrency.values()]
    data = rest.length > 0 ? [...top, other] : top
  }
  return data
}

interface StatusRevenueRow {
  currency: string
  revenue_paid: number
  revenue_not_due: number
  revenue_overdue: number
}

// Same status pivot, but chronological (by year/month) rather than ranked by
// magnitude — for the Monthly Sales trend chart, which needs its months in
// order, not sorted by size. Revenue only (no qty) since the monthly trend
// RPC doesn't track quantity.
export function pivotMonthlyTrend<T extends StatusRevenueRow & { year: number; month: number }>(
  rows: T[],
  monthNames: string[]
): StatusPivotRow[] {
  const order: string[] = []
  const byMonth = new Map<string, StatusPivotRow>()
  for (const row of rows) {
    const key = `${row.year}-${row.month}`
    if (!byMonth.has(key)) {
      byMonth.set(key, { name: `${monthNames[row.month]} ${row.year}`, paid: 0, notDue: 0, overdue: 0, total: 0, breakdown: [] })
      order.push(key)
    }
    const entry = byMonth.get(key)!
    entry.paid += row.revenue_paid
    entry.notDue += row.revenue_not_due
    entry.overdue += row.revenue_overdue
    entry.total += row.revenue_paid + row.revenue_not_due + row.revenue_overdue
    entry.breakdown.push({
      currency: row.currency,
      paid: row.revenue_paid, notDue: row.revenue_not_due, overdue: row.revenue_overdue,
      qtyPaid: 0, qtyNotDue: 0, qtyOverdue: 0,
    })
  }
  return order.map((k) => byMonth.get(k)!)
}
