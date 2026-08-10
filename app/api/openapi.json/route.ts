// OpenAPI 3.0 description of every function in lib/db/registry.ts's
// rpcRegistry, all served through the single POST /api/rpc/{name}
// dispatcher (app/api/rpc/[name]/route.ts). Kept hand-written rather than
// generated, since the source of truth (lib/db/queries/*.ts) rarely
// changes shape — update this alongside those files, not instead of them.
import { NextResponse } from 'next/server'

const nullableString = { type: 'string', nullable: true }
const nullableInt = { type: 'integer', nullable: true }
const money = { type: 'number' }

const commonParamsProperties = {
  p_date_from: { ...nullableString, format: 'date' },
  p_date_to: { ...nullableString, format: 'date' },
  p_location: nullableString,
  p_item: nullableString,
  p_sales_agent: nullableString,
  p_debtor: nullableString,
  p_item_group: nullableString,
  p_item_type: nullableString,
  p_currency: nullableString,
}

const groupByParam = {
  ...nullableString,
  enum: ['item', 'group', 'type'],
  default: 'item',
}

function rpcPath(summary: string, description: string, requestSchema: object, responseSchema: object) {
  return {
    post: {
      summary,
      description,
      requestBody: {
        required: false,
        content: { 'application/json': { schema: requestSchema } },
      },
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: responseSchema } },
        },
        '500': {
          description: 'Query failed',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { error: { type: 'string' } } },
            },
          },
        },
      },
    },
  }
}

const entityOptionArray = {
  type: 'array',
  items: {
    type: 'object',
    properties: { id: { type: 'string' }, name: { type: 'string' } },
  },
}

const performanceRowSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { ...nullableString },
      name: { type: 'string' },
      currency: { type: 'string' },
      credit_qty: { type: 'number' },
      cash_qty: { type: 'number' },
      credit_revenue: money,
      cash_revenue: money,
    },
  },
}

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Presoft Dashboard — Internal RPC API',
    version: '1.0.0',
    description:
      'Internal-only. Every operation below is dispatched through a single route, ' +
      'POST /api/rpc/{name}, where {name} is the path shown in each operation ID. ' +
      'This mirrors the Postgres RPC functions the dashboard used before the real ' +
      'SQL Server migration (see PLAN.md) — client code is unchanged.',
  },
  servers: [{ url: '/api/rpc' }],
  paths: {
    '/get_filter_options_v2': rpcPath(
      'Global FilterBar options',
      'Populates the 4 entity dropdowns, item group/type/currency lists, and date range. Ignores the request body.',
      { type: 'object' },
      {
        type: 'array',
        maxItems: 1,
        items: {
          type: 'object',
          properties: {
            locations: entityOptionArray,
            items: entityOptionArray,
            sales_agents: entityOptionArray,
            debtors: entityOptionArray,
            item_groups: { type: 'array', items: { type: 'string' } },
            item_types: { type: 'array', items: { type: 'string' } },
            currencies: { type: 'array', items: { type: 'string' } },
            date_min: { ...nullableString, format: 'date' },
            date_max: { ...nullableString, format: 'date' },
          },
        },
      }
    ),

    '/get_kpi_summary_v2': rpcPath(
      'Sales Dashboard KPI cards',
      'Total/Cash/Credit revenue x currency, plus total purchase amount (actual PI/PIDTL spend).',
      { type: 'object', properties: commonParamsProperties },
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            currency: { type: 'string' },
            cash_revenue: money,
            credit_revenue: money,
            total_revenue: money,
            total_purchase: money,
          },
        },
      }
    ),

    '/get_item_revenue_v2': rpcPath(
      'Revenue by Item/Group/Type chart',
      'Total value only (Cash/Credit split). Every bucket (not just top 5) — frontend folds the rest into "Other" client-side.',
      {
        type: 'object',
        properties: { ...commonParamsProperties, p_group_by: groupByParam },
      },
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            bucket_name: { type: 'string' },
            currency: { type: 'string' },
            credit_qty: { type: 'number' },
            cash_qty: { type: 'number' },
            credit_revenue: money,
            cash_revenue: money,
          },
        },
      }
    ),

    '/get_item_best_sellers_v2': rpcPath(
      'Best Sellers table',
      'Cash/Credit split. Same p_group_by toggle as get_item_revenue_v2.',
      {
        type: 'object',
        properties: {
          ...commonParamsProperties,
          p_group_by: groupByParam,
          p_limit: { ...nullableInt, default: 5 },
        },
      },
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            bucket_name: { type: 'string' },
            currency: { type: 'string' },
            credit_qty: { type: 'number' },
            cash_qty: { type: 'number' },
            credit_revenue: money,
            cash_revenue: money,
          },
        },
      }
    ),

    '/get_monthly_trend_v2': rpcPath(
      'Monthly Sales trend chart',
      'Cash/Credit revenue split, per month.',
      { type: 'object', properties: commonParamsProperties },
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            year: { type: 'integer' },
            month: { type: 'integer' },
            currency: { type: 'string' },
            cash_revenue: money,
            credit_revenue: money,
          },
        },
      }
    ),

    '/get_monthly_breakdown_v2': rpcPath(
      'Monthly Sales breakdown table',
      'Cash/Credit columns per month. p_limit_months caps to the latest N months present in the filtered data; null = unlimited.',
      {
        type: 'object',
        properties: { ...commonParamsProperties, p_limit_months: nullableInt },
      },
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            year: { type: 'integer' },
            month: { type: 'integer' },
            currency: { type: 'string' },
            credit_revenue: money,
            cash_revenue: money,
            credit_qty: { type: 'number' },
            cash_qty: { type: 'number' },
          },
        },
      }
    ),

    '/get_performance_location_v2': rpcPath(
      'Performance page — by Location',
      'p_limit null = unlimited (Performance page always fetches everything and re-slices client-side).',
      { type: 'object', properties: { ...commonParamsProperties, p_limit: nullableInt } },
      performanceRowSchema
    ),

    '/get_performance_item_v2': rpcPath(
      'Performance page — by Item/Group/Type',
      '`id` is only present when grouped by individual Item — a Group/Type row aggregates many items and has no single id.',
      {
        type: 'object',
        properties: { ...commonParamsProperties, p_limit: nullableInt, p_group_by: groupByParam },
      },
      performanceRowSchema
    ),

    '/get_performance_sales_agent_v2': rpcPath(
      'Performance page — by Sales Agent',
      'p_limit null = unlimited.',
      { type: 'object', properties: { ...commonParamsProperties, p_limit: nullableInt } },
      performanceRowSchema
    ),

    '/get_performance_debtor_v2': rpcPath(
      'Performance page — by Debtor',
      'p_limit null = unlimited.',
      { type: 'object', properties: { ...commonParamsProperties, p_limit: nullableInt } },
      performanceRowSchema
    ),

    '/get_item_catalog_v2': rpcPath(
      'Item page catalog',
      'p_search null = browse mode (top p_limit items ranked by p_sort); p_search set = lookup mode (every match, unlimited, still ordered by p_sort). ' +
        'Uses its own param set, not the common filter params — no date/sales_agent/debtor/currency. ' +
        'p_location is a dbo.Location code — same list as get_filter_options_v2\'s `locations` (used by every other page too, not just Item). ' +
        'Cost/price are single-valued per item — both come from ItemUOM Cost/Price on the item\'s BaseUOM row (not a stock-ledger snapshot, a recent sale price, or a per-location ItemLocationPrice override anymore). Every row for the same item repeats the same cost/price; qty_on_hand is summed across UOM/batch into one total per location.',
      {
        type: 'object',
        properties: {
          p_search: nullableString,
          p_item_group: nullableString,
          p_item_type: nullableString,
          p_location: nullableString,
          p_item: nullableString,
          p_sort: { ...nullableString, enum: ['item_code', 'cost_desc', 'cost_asc', 'price_desc', 'price_asc'], default: 'item_code' },
          p_limit: { ...nullableInt, default: 6 },
        },
      },
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            item_id: { type: 'string' },
            item_code: { type: 'string' },
            description: { type: 'string' },
            item_group: { ...nullableString },
            item_type: { ...nullableString },
            location_name: { ...nullableString },
            qty_on_hand: { type: 'number' },
            cost: money,
            unit_price: money,
          },
        },
      }
    ),
  },
}

export async function GET() {
  return NextResponse.json(openApiSpec)
}
