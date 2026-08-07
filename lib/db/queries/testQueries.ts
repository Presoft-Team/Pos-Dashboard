// Ad-hoc verification queries for the /test page — not part of the real
// rpc_v2 surface, no filters, just "does this data look right." Safe to
// delete this file + its registry entry once verification is done.
import 'server-only'
import { getRequest } from '@/lib/mssql'

// Individual invoices — one row per IV document, not aggregated. No paid/
// unpaid filtering — just find the invoice by DocNo.
//
// No search: browse mode, most recent 50 invoices. With search: every
// invoice whose DocNo contains the search text (e.g. "2601/171" finds
// "INV 2601/171").
const NO_LIMIT = 2147483647

export async function getCreditPaidIndividual(search?: string | null) {
  const request = await getRequest()
  const trimmed = search?.trim() || null
  request.input('search', trimmed)
  request.input('limit', trimmed ? NO_LIMIT : 50)
  const result = await request.query(`
    SELECT TOP (@limit)
      iv.DocNo AS doc_no, iv.DocDate AS order_date, iv.DebtorCode AS debtor_id,
      iv.BranchCode AS branch_id, iv.SalesAgent AS sales_agent_id, iv.CurrencyCode AS currency,
      ari.DueDate AS due_date, ari.Outstanding AS outstanding,
      SUM(ivd.SubTotal) AS revenue
    FROM IV iv
    JOIN IVDTL ivd ON ivd.DocKey = iv.DocKey
    LEFT JOIN ARInvoice ari ON ari.SourceType = 'IV' AND ari.SourceKey = iv.DocKey
    WHERE (@search IS NULL) OR (iv.DocNo LIKE '%' + @search + '%')
    GROUP BY iv.DocNo, iv.DocDate, iv.DebtorCode, iv.BranchCode, iv.SalesAgent, iv.CurrencyCode, ari.DueDate, ari.Outstanding
    ORDER BY iv.DocDate DESC;
  `)
  return result.recordset
}
