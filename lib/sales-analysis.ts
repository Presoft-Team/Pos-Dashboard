import { SalesAnalysisRow } from '@/types'

// Every dimension the Multi Dimension Sales Analysis panel's Columns tab can
// group by — matches get_sales_analysis_v2's row shape (see
// ReportsController.SalesAnalysis), minus the numeric fields, which live in
// ANALYSIS_MEASURE_FIELDS (the Options tab's Data Area Options) instead.
export type AnalysisColumnKey = Exclude<
  keyof SalesAnalysisRow,
  'qty' | 'smallest_qty' | 'foc_qty' | 'unit_price' | 'discount' | 'sub_total'
  | 'local_sub_total' | 'local_total_cost' | 'local_profit' | 'profit_margin' | 'currency'
>

export const ANALYSIS_COLUMN_FIELDS: { key: AnalysisColumnKey; label: string }[] = [
  { key: 'doc_no', label: 'Doc No.' },
  { key: 'doc_date', label: 'Date' },
  { key: 'doc_type', label: 'Doc. Type' },
  { key: 'debtor_code', label: 'Debtor Code' },
  { key: 'company_name', label: 'Company Name' },
  { key: 'debtor_sales_agent', label: 'Debtor Sales Agent' },
  { key: 'debtor_type', label: 'Debtor Type' },
  { key: 'area_code', label: 'Area Code' },
  { key: 'branch_code', label: 'Branch' },
  { key: 'branch_name', label: 'Branch Name' },
  { key: 'item_code', label: 'Item Code' },
  { key: 'item_description', label: 'Item Description' },
  { key: 'item_description_2', label: 'Item Description 2' },
  { key: 'item_group', label: 'Item Group' },
  { key: 'item_type', label: 'Item Type' },
  { key: 'item_brand', label: 'Item Brand' },
  { key: 'item_class', label: 'Item Class' },
  { key: 'item_category', label: 'Item Category' },
  { key: 'item_location', label: 'Item Location' },
  { key: 'item_batch_no', label: 'Item Batch No.' },
  { key: 'serial_no', label: 'Serial No.' },
  { key: 'uom', label: 'UOM' },
  { key: 'project', label: 'Project' },
  { key: 'department', label: 'Department' },
  { key: 'acc_no', label: 'Acc. No.' },
  { key: 'ship_via', label: 'Ship Via' },
  { key: 'shipping_info', label: 'Shipping Info' },
  { key: 'main_supplier', label: 'Main Supplier' },
  { key: 'main_supplier_desc', label: 'Main Supplier Desc' },
]

// Data Area Options — numeric measures summed per group. `profitMargin` is
// special-cased at display time (recomputed from the summed profit/subtotal
// of the group, not averaged row-margins) since summing a percentage isn't
// meaningful.
export type AnalysisMeasureKey =
  | 'local_sub_total' | 'sub_total' | 'qty' | 'smallest_qty' | 'foc_qty'
  | 'unit_price' | 'local_total_cost' | 'local_profit' | 'profit_margin'

export const ANALYSIS_MEASURE_FIELDS: { key: AnalysisMeasureKey; label: string }[] = [
  { key: 'local_sub_total', label: 'Local SubTotal' },
  { key: 'sub_total', label: 'SubTotal' },
  { key: 'qty', label: 'Quantity' },
  { key: 'smallest_qty', label: 'Smallest Quantity' },
  { key: 'foc_qty', label: 'FOC Qty' },
  { key: 'unit_price', label: 'Unit Price' },
  { key: 'local_total_cost', label: 'Local Total Cost' },
  { key: 'local_profit', label: 'Local Profit' },
  { key: 'profit_margin', label: 'Profit Margin' },
]

export const DEFAULT_ANALYSIS_MEASURES: AnalysisMeasureKey[] = ['local_sub_total']

// Document Options — which document types get UNIONed into the line set.
// Quotation/Adv Quotation/Sales Order are shown so the panel matches
// AutoCount's own field list, but aren't wired server-side yet (see
// ReportsController.AnalysisDocBranches) — non-committed documents with a
// different shape (no LocalSubTotal/LocalTotalCost), left for a follow-up.
export const ANALYSIS_DOC_TYPE_OPTIONS: { key: string; label: string; available: boolean }[] = [
  { key: 'invoice', label: 'Invoice', available: true },
  { key: 'cashsale', label: 'Cash Sale', available: true },
  { key: 'debitnote', label: 'Debit Note', available: true },
  { key: 'creditnote', label: 'Credit Note', available: true },
  { key: 'quotation', label: 'Quotation', available: false },
  { key: 'advquotation', label: 'Adv. Quotation', available: false },
  { key: 'salesorder', label: 'Sales Order', available: false },
]

export const DEFAULT_ANALYSIS_DOC_TYPES = ANALYSIS_DOC_TYPE_OPTIONS.filter((d) => d.available).map((d) => d.key)
