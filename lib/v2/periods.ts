// Period model for the /v2 UI.
//
// Two different sources sit behind the four groupings:
//
//   Month / Year — GET /api/reports/monthly (proxied as
//     get_monthly_trend_v2), one row per (year, month). Years are those
//     rows summed.
//   Date / Week  — GET /api/reports/sales-documents (proxied as
//     get_recent_sales_v2), one row per document with its DocDate and
//     amount, summed by day here in the browser. There is no daily
//     *report*, but the documents themselves carry the date.
//
// The two reconcile by construction: `monthly` is
// `SELECT YEAR(DocDate), MONTH(DocDate), SUM(Amount) FROM docs` over
// SalesLinesCte + DocsCte(RevenueAccountTest), and `sales-documents`
// selects one row per document from that identical `docs` CTE. Summing the
// documents of a month therefore gives the same figure the Month view
// shows — provided the document fetch isn't capped, hence the NO-LIMIT
// call in components/v2/dashboard-view.tsx.
import { MonthlyRow } from '@/types'

export type V2GroupBy = 'day' | 'week' | 'month' | 'year'

export interface PeriodRange {
  date_from: string
  date_to: string
}

export interface ChartBar {
  // Primary label under the bar ('Wk', a month name, a year, or '' for a
  // plain calendar day).
  d: string
  // Secondary label under that.
  date: string
  amt: number
  today: boolean
  weekend?: boolean
}

export interface GroupByConfig {
  title: string
  sub: string
  cardSub: string
  periodName: string
  // How many bars the chart shows, and therefore how far back the chart's
  // own fetch reaches.
  bars: number
  // How far back the Prev button / swipe gesture may page.
  maxOffset: number
  // Which report backs the chart in this mode.
  source: 'monthly' | 'documents'
}

export const GROUPBY_CONFIG: Record<V2GroupBy, GroupByConfig> = {
  day: {
    title: 'Sales by Date',
    sub: 'Daily view · up to today',
    cardSub: 'Daily revenue overview',
    periodName: 'Day',
    bars: 30,
    maxOffset: 365,
    source: 'documents',
  },
  week: {
    title: 'Sales by Week',
    sub: 'Weekly view · up to this week',
    cardSub: 'Weekly revenue overview',
    periodName: 'Week',
    bars: 24,
    maxOffset: 104,
    source: 'documents',
  },
  month: {
    title: 'Sales by Month',
    sub: 'Monthly view · up to this month',
    cardSub: 'Monthly revenue overview',
    periodName: 'Month',
    bars: 24,
    maxOffset: 60,
    source: 'monthly',
  },
  year: {
    title: 'Sales by Year',
    sub: 'Yearly view · up to this year',
    cardSub: 'Yearly revenue overview',
    periodName: 'Year',
    bars: 10,
    maxOffset: 20,
    source: 'monthly',
  },
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Local-time ISO date. Deliberately not toISOString(): that converts to UTC
// first, which in UTC+8 turns the 1st of a month into the last day of the
// previous one and silently shifts every range by a day. The same reason
// document dates are keyed on their leading 10 characters rather than
// parsed into a Date.
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  const x = midnight(d)
  x.setDate(x.getDate() + n)
  return x
}

// Monday-start weeks, matching how Malaysian retail books read a trading
// week. getDay() is Sunday-based, hence the rotation.
function startOfWeek(d: Date): Date {
  const x = midnight(d)
  return addDays(x, -((x.getDay() + 6) % 7))
}

// The date range one period back from now. offset 0 is the current period.
export function periodRange(groupBy: V2GroupBy, offset: number, now: Date = new Date()): PeriodRange {
  if (groupBy === 'day') {
    const day = isoDate(addDays(now, -offset))
    return { date_from: day, date_to: day }
  }
  if (groupBy === 'week') {
    const start = addDays(startOfWeek(now), -offset * 7)
    return { date_from: isoDate(start), date_to: isoDate(addDays(start, 6)) }
  }
  if (groupBy === 'year') {
    const year = now.getFullYear() - offset
    return { date_from: `${year}-01-01`, date_to: `${year}-12-31` }
  }
  const first = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  // Day 0 of the next month is the last day of this one — no month-length table.
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  return { date_from: isoDate(first), date_to: isoDate(last) }
}

// The range the chart itself covers: enough periods back to fill its bars.
export function chartRange(groupBy: V2GroupBy, now: Date = new Date()): PeriodRange {
  const { bars } = GROUPBY_CONFIG[groupBy]
  return {
    date_from: periodRange(groupBy, bars - 1, now).date_from,
    date_to: periodRange(groupBy, 0, now).date_to,
  }
}

export function periodLabel(groupBy: V2GroupBy, offset: number, now: Date = new Date()): string {
  if (groupBy === 'day') {
    if (offset === 0) return 'Today'
    if (offset === 1) return 'Yesterday'
    const d = addDays(now, -offset)
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  }
  if (groupBy === 'week') {
    if (offset === 0) return 'This Week'
    if (offset === 1) return 'Last Week'
    const start = addDays(startOfWeek(now), -offset * 7)
    const end = addDays(start, 6)
    return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`
  }
  if (groupBy === 'year') return String(now.getFullYear() - offset)
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

// --- Chart bars ----------------------------------------------------------

// Month / Year, from get_monthly_trend_v2.
//
// The report only returns months that had activity, so a quiet month is a
// missing row rather than a zero row. Every bar position is seeded at 0
// first and the real rows overlaid, so a gap reads as "nothing sold" rather
// than silently shortening the axis — the same treatment
// lib/currency.ts's pivotMonthlyTrend() gives the existing Monthly page.
export function buildMonthlyBars(
  groupBy: 'month' | 'year',
  rows: MonthlyRow[],
  now: Date = new Date()
): ChartBar[] {
  const { bars } = GROUPBY_CONFIG[groupBy]

  if (groupBy === 'year') {
    const byYear = new Map<number, number>()
    for (const r of rows) byYear.set(r.year, (byYear.get(r.year) ?? 0) + r.revenue)
    const out: ChartBar[] = []
    for (let i = bars - 1; i >= 0; i--) {
      const year = now.getFullYear() - i
      out.push({ d: String(year), date: '', amt: byYear.get(year) ?? 0, today: i === 0 })
    }
    return out
  }

  const byMonth = new Map<string, number>()
  for (const r of rows) {
    const key = `${r.year}-${r.month}`
    byMonth.set(key, (byMonth.get(key) ?? 0) + r.revenue)
  }
  const out: ChartBar[] = []
  for (let i = bars - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    out.push({
      d: MONTH_NAMES[d.getMonth()],
      date: String(d.getFullYear()),
      amt: byMonth.get(key) ?? 0,
      today: i === 0,
    })
  }
  return out
}

// Date / Week, from documents already summed per calendar day (see
// sumByDate). A day with no documents is absent from the map and renders
// as a real 0, not a gap.
export function buildDailyBars(
  groupBy: 'day' | 'week',
  byDate: Map<string, number>,
  now: Date = new Date()
): ChartBar[] {
  const { bars } = GROUPBY_CONFIG[groupBy]
  const out: ChartBar[] = []

  if (groupBy === 'day') {
    for (let i = bars - 1; i >= 0; i--) {
      const d = addDays(now, -i)
      const dow = d.getDay()
      out.push({
        d: '',
        date: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`,
        amt: byDate.get(isoDate(d)) ?? 0,
        weekend: dow === 0 || dow === 6,
        today: i === 0,
      })
    }
    return out
  }

  for (let w = bars - 1; w >= 0; w--) {
    const start = addDays(startOfWeek(now), -w * 7)
    let amt = 0
    for (let k = 0; k < 7; k++) amt += byDate.get(isoDate(addDays(start, k))) ?? 0
    out.push({
      d: 'Wk',
      date: `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}`,
      amt,
      today: w === 0,
    })
  }
  return out
}

// Documents -> one total per calendar day.
//
// `amount` is signed (a credit note arrives negative), which is exactly
// what makes these sums agree with the monthly report rather than
// overstating every day that had a return. doc_date is an ISO datetime;
// the leading 10 characters are the local calendar date as stored, so it
// is sliced rather than parsed — `new Date(...)` would re-interpret it in
// the viewer's timezone and push evening documents into the next day.
export function sumByDate(docs: { doc_date: string; amount: number }[]): Map<string, number> {
  const byDate = new Map<string, number>()
  for (const doc of docs) {
    const key = doc.doc_date.slice(0, 10)
    if (!key) continue
    byDate.set(key, (byDate.get(key) ?? 0) + doc.amount)
  }
  return byDate
}
