// Shared filter parsing (Express query string -> typed object) and param
// binding (typed object -> mssql request params), used by every route that
// selects from the `sales` CTE. Ported from the dashboard app's
// lib/db/params.ts, with clean REST param names instead of the old
// `p_`-prefixed internal ones.
import sql from 'mssql'
import { Request } from 'express'

export interface CommonFilters {
  date_from?: string | null
  date_to?: string | null
  branch?: string | null
  item?: string | null
  sales_agent?: string | null
  debtor?: string | null
  creditor?: string | null
  item_group?: string | null
  item_type?: string | null
  currency?: string | null
}

function str(v: unknown): string | null {
  if (typeof v !== 'string' || v.trim() === '') return null
  return v
}

export function parseCommonFilters(req: Request): CommonFilters {
  const q = req.query
  return {
    date_from: str(q.date_from),
    date_to: str(q.date_to),
    branch: str(q.branch),
    item: str(q.item),
    sales_agent: str(q.sales_agent),
    debtor: str(q.debtor),
    creditor: str(q.creditor),
    item_group: str(q.item_group),
    item_type: str(q.item_type),
    currency: str(q.currency),
  }
}

// Explicitly typed so NULL filter values don't trip up SQL Server's type
// inference when compiling `<column> >= @param`.
export function bindCommonFilters(request: sql.Request, f: CommonFilters) {
  request.input('date_from', sql.Date, f.date_from ?? null)
  request.input('date_to', sql.Date, f.date_to ?? null)
  request.input('branch', sql.NVarChar(50), f.branch ?? null)
  request.input('item', sql.NVarChar(50), f.item ?? null)
  request.input('sales_agent', sql.NVarChar(50), f.sales_agent ?? null)
  request.input('debtor', sql.NVarChar(50), f.debtor ?? null)
  request.input('creditor', sql.NVarChar(50), f.creditor ?? null)
  request.input('item_group', sql.NVarChar(100), f.item_group ?? null)
  request.input('item_type', sql.NVarChar(100), f.item_type ?? null)
  request.input('currency', sql.NVarChar(10), f.currency ?? null)
}
