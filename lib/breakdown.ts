import { SortOption } from '@/components/sort-select'

// Shared sort behaviour for PerformanceTable's breakdown rows.

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
    { value: 'amount_asc', label: amountLabel },
    { value: 'amount_desc', label: `${amountLabel} desc` },
    ...(showQty
      ? [
          { value: 'qty_asc', label: 'Qty' },
          { value: 'qty_desc', label: 'Qty desc' },
        ]
      : []),
    { value: 'name_asc', label: 'Name' },
    { value: 'name_desc', label: 'Name desc' },
  ]
}

// Sorts a breakdown's rows by the chosen option.
export function applyBreakdown<T extends BreakdownRow>(
  rows: T[],
  sort: string,
  amountOf: (row: T) => number,
  qtyOf: (row: T) => number = () => 0
): T[] {
  // Copy before sorting — the array belongs to the caller's state, and
  // sorting in place would mutate it.
  const sorted = [...rows]
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
