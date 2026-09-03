import { SortOption } from '@/components/sort-select'

// Shared search + sort behaviour for the breakdown tables. PerformanceTable
// (revenue) and PurchaseTable (purchase) are structurally identical apart
// from which amount field they read, so the logic lives here once and each
// table passes its own key rather than duplicating it.

// Only `name` is required. The amount and qty are read through accessors
// the caller supplies rather than by string key, so the real row types
// (PerformanceRow, PurchaseRow, …) satisfy this as-is — an index signature
// here would force every one of them to declare one.
export interface BreakdownRow {
  name: string
}

// Server order is amount-descending, so that stays the default — picking a
// sort should feel like a change from what's shown, not a re-shuffle on
// arrival.
export const DEFAULT_BREAKDOWN_SORT = 'amount_desc'

// The buckets the reports use for documents that name no entity at all.
// They're real money — a sale with no agent recorded still happened — but
// they're not a person, item or company, so they have no detail to drill
// into and can dwarf every genuine row. Kept in the data, hideable in the UI.
//
// In practice only (No Item) and (No Agent) occur: a document line can carry
// no item, and SalesAgent is optional, but debtor/creditor are mandatory on
// every AR/AP document, so those two labels should never appear. Their
// COALESCE fallbacks still exist in ReportsController.ByParty, so they're
// listed here too — if dirty data ever produces one, the checkbox governs it
// rather than it becoming an undrillable row nothing can hide.
//
// These strings must match the labels the report endpoints emit
// (ReportsController: ItemBuckets, ByParty, NoAgentLabel).
const UNATTRIBUTED_LABELS = new Set([
  '(No Item)', '(No Agent)', '(No Debtor)', '(No Creditor)',
  // The Sales sub-pages' dimensions. Unlike the pages above, those drop
  // their bucket outright rather than offering a checkbox.
  '(No Area)', '(No Location)',
  // The best-seller chart's dimensions. A line with no item attached isn't
  // a seller, and it dwarfs the real ones — the same reason (No Agent) is
  // dropped from the breakdown above it.
  '(No Item Group)', '(No Item Type)', '(No Item Brand)',
  '(No Item Class)', '(No Item Category)',
])

export function isUnattributed(name: string): boolean {
  return UNATTRIBUTED_LABELS.has(name)
}

// Drops the unattributed bucket from a breakdown. Hiding it means the rows
// no longer add up to the KPI total above them — that's the trade the
// checkbox makes, and why it defaults to showing them.
export function withoutUnattributed<T extends BreakdownRow>(rows: T[], show: boolean): T[] {
  return show ? rows : rows.filter((r) => !isUnattributed(r.name))
}

// `amountLabel` is the column's own word ("Revenue"/"Purchase"), so the menu
// reads in the table's own terms instead of a generic "Amount". Qty options
// are offered only for the tables that have a Qty column — the entity
// breakdowns read document headers, which carry no quantity.
export function breakdownSortOptions(amountLabel: string, showQty: boolean): SortOption[] {
  return [
    { value: 'amount_desc', label: `${amountLabel} (High → Low)` },
    { value: 'amount_asc', label: `${amountLabel} (Low → High)` },
    ...(showQty
      ? [
          { value: 'qty_desc', label: 'Qty (High → Low)' },
          { value: 'qty_asc', label: 'Qty (Low → High)' },
        ]
      : []),
    { value: 'name_asc', label: 'Name (A → Z)' },
    { value: 'name_desc', label: 'Name (Z → A)' },
  ]
}

// Options for the search combobox: the names actually present in these rows,
// so the list can never offer something that filters to nothing. Deduped —
// a name appearing twice would otherwise give two identical rows with the
// same id, which React keys and the combobox's own highlight both dislike.
export function breakdownSearchOptions(rows: BreakdownRow[]) {
  const seen = new Set<string>()
  const options: { id: string; name: string }[] = []
  for (const row of rows) {
    if (!row.name || seen.has(row.name)) continue
    seen.add(row.name)
    options.push({ id: row.name, name: row.name })
  }
  return options.sort((a, b) => a.name.localeCompare(b.name))
}

// Filter then sort. `search` is a name — the combobox sets it to an exact
// option, but a free-typed value that was never committed is matched as a
// substring too, so typing without picking still narrows the table.
export function applyBreakdown<T extends BreakdownRow>(
  rows: T[],
  search: string,
  sort: string,
  amountOf: (row: T) => number,
  qtyOf: (row: T) => number = () => 0
): T[] {
  const term = search.trim().toLowerCase()
  const filtered = term
    ? rows.filter((r) => r.name?.toLowerCase().includes(term))
    : rows

  // Copy before sorting — the array belongs to the caller's state, and
  // sorting in place would mutate it.
  const sorted = [...filtered]
  switch (sort) {
    case 'amount_asc':
      sorted.sort((a, b) => amountOf(a) - amountOf(b))
      break
    case 'qty_desc':
      sorted.sort((a, b) => qtyOf(b) - qtyOf(a))
      break
    case 'qty_asc':
      sorted.sort((a, b) => qtyOf(a) - qtyOf(b))
      break
    case 'name_asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'name_desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name))
      break
    default:
      sorted.sort((a, b) => amountOf(b) - amountOf(a))
  }
  return sorted
}
