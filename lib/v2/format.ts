// Money/number formatting for the /v2 UI.
//
// The prototype (src/data/mockChart.js, src/data/itemsData.js) hard-coded
// "RM " because its mock numbers had no currency attached. Real rows do —
// autocount-write-service reports every aggregate in the account book's own
// currency and app/api/presoft/[name]/route.ts labels each row with it — so
// these take the code from the row and go through lib/currency.ts, the same
// helper the eight existing pages use.
import { currencySymbol, DEFAULT_CURRENCY } from '@/lib/currency'

// Whole-ringgit figure, matching the prototype's dense card rows (which
// never showed cents). The existing pages' formatMoney() keeps 2 decimals;
// that's deliberate there and deliberately different here.
export function fmtMoney(amount: number, currency: string | null | undefined = DEFAULT_CURRENCY): string {
  return `${currencySymbol(currency)} ${Math.round(amount).toLocaleString('en-MY')}`
}

// Full precision, for the item detail overlay where cost/price accuracy
// matters more than compactness.
export function fmtPrice(amount: number, currency: string | null | undefined = DEFAULT_CURRENCY): string {
  return `${currencySymbol(currency)} ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Abbreviated label that sits above a chart bar, where there is only ~42px
// of width. Negative totals are real (a month whose credit notes outweigh
// its invoices), so the sign is carried through rather than dropped.
export function fmtBarVal(amount: number, currency: string | null | undefined = DEFAULT_CURRENCY): string {
  const symbol = currencySymbol(currency)
  const sign = amount < 0 ? '-' : ''
  const n = Math.abs(amount)
  if (n >= 1_000_000) return `${sign}${symbol} ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 100_000) return `${sign}${symbol} ${Math.round(n / 1000)}k`
  if (n >= 1000) return `${sign}${symbol} ${(n / 1000).toFixed(1)}k`
  return `${sign}${symbol} ${Math.round(n)}`
}

export function fmtQty(qty: number): string {
  return qty.toLocaleString('en-MY')
}
