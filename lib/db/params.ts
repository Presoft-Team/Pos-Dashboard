// Shared param types/binding for every RPC-equivalent query. Param names
// match what lib/filters.ts's toParams() already sends (p_date_from,
// p_branch, ...) — client code needs zero changes for this reason.
import 'server-only'
import sql from 'mssql'

export interface CommonParams {
  p_date_from?: string | null
  p_date_to?: string | null
  p_branch?: string | null
  p_item?: string | null
  p_sales_agent?: string | null
  p_debtor?: string | null
  p_item_group?: string | null
  p_item_type?: string | null
  p_currency?: string | null
}

// Explicitly typed so NULL filter values don't trip up SQL Server's type
// inference when compiling `<column> >= @param` — see lib/mssql.ts's
// `query()` for why this needs a dedicated request rather than the generic
// auto-inferred-type helper.
export function bindCommonParams(request: sql.Request, p: CommonParams) {
  request.input('p_date_from', sql.Date, p.p_date_from ?? null)
  request.input('p_date_to', sql.Date, p.p_date_to ?? null)
  request.input('p_branch', sql.NVarChar(50), p.p_branch ?? null)
  request.input('p_item', sql.NVarChar(50), p.p_item ?? null)
  request.input('p_sales_agent', sql.NVarChar(50), p.p_sales_agent ?? null)
  request.input('p_debtor', sql.NVarChar(50), p.p_debtor ?? null)
  request.input('p_item_group', sql.NVarChar(100), p.p_item_group ?? null)
  request.input('p_item_type', sql.NVarChar(100), p.p_item_type ?? null)
  request.input('p_currency', sql.NVarChar(10), p.p_currency ?? null)
}
