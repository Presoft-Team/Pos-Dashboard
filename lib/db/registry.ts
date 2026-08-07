// Maps rpc_v2.sql function names (unchanged client-side — see
// lib/filters.ts and every page's supabase.rpc(...) calls, none of which
// need to change) to their real-database equivalents. Every entry here is
// a "CONFIRMED" section in PLAN.md.
import 'server-only'
import { getFilterOptions } from './queries/filterOptions'
import { getKpiSummary } from './queries/kpiSummary'
import { getItemRevenue } from './queries/itemRevenue'
import { getItemBestSellers } from './queries/bestSellers'
import { getMonthlyTrend } from './queries/monthlyTrend'
import { getMonthlyBreakdown } from './queries/monthlyBreakdown'
import {
  getPerformanceBranch,
  getPerformanceItem,
  getPerformanceSalesAgent,
  getPerformanceDebtor,
} from './queries/performance'
import { getItemCatalog } from './queries/itemCatalog'

// Params arrive as parsed JSON from the client shim (lib/db/client.ts) —
// inherently untyped at this boundary, same as any req.json() result.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcHandler = (params: any) => Promise<unknown>

export const rpcRegistry: Record<string, RpcHandler> = {
  get_filter_options_v2: () => getFilterOptions(),
  get_kpi_summary_v2: (p) => getKpiSummary(p),
  get_item_revenue_v2: (p) => getItemRevenue(p),
  get_item_best_sellers_v2: (p) => getItemBestSellers(p),
  get_monthly_trend_v2: (p) => getMonthlyTrend(p),
  get_monthly_breakdown_v2: (p) => getMonthlyBreakdown(p),
  get_performance_branch_v2: (p) => getPerformanceBranch(p),
  get_performance_item_v2: (p) => getPerformanceItem(p),
  get_performance_sales_agent_v2: (p) => getPerformanceSalesAgent(p),
  get_performance_debtor_v2: (p) => getPerformanceDebtor(p),
  get_item_catalog_v2: (p) => getItemCatalog(p),
}
