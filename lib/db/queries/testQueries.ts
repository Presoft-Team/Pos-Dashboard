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

// Join-integrity check for the revenue CTEs in sql-fragments.ts. None of
// the DocKey (header<->detail) or ItemCode (detail->Item) links used by
// SALES_CTE/PURCHASES_CTE are backed by a real FK constraint in the DB —
// this surfaces actual orphan counts so "the joins look right on paper"
// can be confirmed against real data instead of assumed. Every count
// should be 0; a non-zero count points at exactly which link is unsafe.
export async function getRevenueJoinIntegrity() {
  const request = await getRequest()
  const result = await request.query(`
    SELECT 'CSDTL -> CS (DocKey)' AS check_name, COUNT(*) AS orphan_count
    FROM CSDTL csd WHERE NOT EXISTS (SELECT 1 FROM CS cs WHERE cs.DocKey = csd.DocKey)
    UNION ALL
    SELECT 'IVDTL -> IV (DocKey)', COUNT(*)
    FROM IVDTL ivd WHERE NOT EXISTS (SELECT 1 FROM IV iv WHERE iv.DocKey = ivd.DocKey)
    UNION ALL
    SELECT 'CNDTL -> CN (DocKey)', COUNT(*)
    FROM CNDTL cnd WHERE NOT EXISTS (SELECT 1 FROM CN cn WHERE cn.DocKey = cnd.DocKey)
    UNION ALL
    SELECT 'PIDTL -> PI (DocKey)', COUNT(*)
    FROM PIDTL pid WHERE NOT EXISTS (SELECT 1 FROM PI pi WHERE pi.DocKey = pid.DocKey)
    UNION ALL
    SELECT 'PRDTL -> PR (DocKey)', COUNT(*)
    FROM PRDTL prd WHERE NOT EXISTS (SELECT 1 FROM PR pr WHERE pr.DocKey = prd.DocKey)
    UNION ALL
    SELECT 'PODTL -> PO (DocKey)', COUNT(*)
    FROM PODTL pod WHERE NOT EXISTS (SELECT 1 FROM PO po WHERE po.DocKey = pod.DocKey)
    UNION ALL
    SELECT 'CSDTL.ItemCode -> Item', COUNT(*)
    FROM CSDTL csd WHERE csd.ItemCode IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM Item i WHERE i.ItemCode = csd.ItemCode)
    UNION ALL
    SELECT 'IVDTL.ItemCode -> Item', COUNT(*)
    FROM IVDTL ivd WHERE ivd.ItemCode IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM Item i WHERE i.ItemCode = ivd.ItemCode)
    UNION ALL
    SELECT 'PIDTL.ItemCode -> Item', COUNT(*)
    FROM PIDTL pid WHERE pid.ItemCode IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM Item i WHERE i.ItemCode = pid.ItemCode)
    UNION ALL
    SELECT 'PRDTL.ItemCode -> Item', COUNT(*)
    FROM PRDTL prd WHERE prd.ItemCode IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM Item i WHERE i.ItemCode = prd.ItemCode)
    UNION ALL
    SELECT 'PODTL.ItemCode -> Item', COUNT(*)
    FROM PODTL pod WHERE pod.ItemCode IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM Item i WHERE i.ItemCode = pod.ItemCode)
    UNION ALL
    SELECT 'CN.OurInvoiceNo -> neither CS nor IV', COUNT(*)
    FROM CN cn WHERE cn.OurInvoiceNo IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM CS cs WHERE cs.DocNo = cn.OurInvoiceNo)
      AND NOT EXISTS (SELECT 1 FROM IV iv WHERE iv.DocNo = cn.OurInvoiceNo);
  `)
  return result.recordset
}

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
