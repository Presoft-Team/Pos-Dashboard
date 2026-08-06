import swaggerJsdoc from 'swagger-jsdoc'
import path from 'node:path'

// Reusable query parameters, referenced from route JSDoc blocks via
// `$ref: '#/components/parameters/<name>'` — keeps every endpoint's
// parameter docs consistent instead of retyping the same description 12 times.
const commonFilterParams = {
  date_from: { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Inclusive lower bound on order date (YYYY-MM-DD).' },
  date_to: { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Inclusive upper bound on order date (YYYY-MM-DD).' },
  branch: { name: 'branch', in: 'query', schema: { type: 'string' }, description: 'Branch code (Branch.BranchCode).' },
  item: { name: 'item', in: 'query', schema: { type: 'string' }, description: 'Item code (Item.ItemCode).' },
  sales_agent: { name: 'sales_agent', in: 'query', schema: { type: 'string' }, description: 'Sales agent code (SalesAgent.SalesAgent).' },
  debtor: { name: 'debtor', in: 'query', schema: { type: 'string' }, description: 'Debtor account number (Debtor.AccNo).' },
  creditor: { name: 'creditor', in: 'query', schema: { type: 'string' }, description: 'Creditor account number (Creditor.AccNo).' },
  item_group: { name: 'item_group', in: 'query', schema: { type: 'string' }, description: 'Item.ItemGroup.' },
  item_type: { name: 'item_type', in: 'query', schema: { type: 'string' }, description: 'Item.ItemType.' },
  currency: { name: 'currency', in: 'query', schema: { type: 'string' }, description: 'Currency code, e.g. MYR.' },
  group_by: { name: 'group_by', in: 'query', schema: { type: 'string', enum: ['item', 'group', 'type'], default: 'item' }, description: 'Bucket by individual item, item group, or item type.' },
  limit: { name: 'limit', in: 'query', schema: { type: 'integer', default: 5 }, description: 'Max rows to return, ranked by revenue.' },
}

export const openapiSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Presoft Dashboard API',
      version: '1.0.0',
      description:
        'Real-time sales/purchases data from the AutoCount/Presoft SQL Server ' +
        'account book. Mirrors the same 9 queries the internal dashboard app ' +
        'uses (see PLAN.md in the main repo) — no auth yet, first cut.',
    },
    servers: [{ url: `http://localhost:${process.env.PORT ?? 4000}`, description: 'Local' }],
    components: { parameters: commonFilterParams },
    tags: [
      { name: 'Filters', description: 'Dropdown/filter option lists' },
      { name: 'Sales', description: 'Revenue, best sellers, monthly trend/breakdown' },
      { name: 'Performance', description: 'Top-N breakdowns per dimension' },
      { name: 'Items', description: 'Item catalog' },
    ],
  },
  // Forward slashes on purpose, even on Windows — the glob library
  // swagger-jsdoc uses internally doesn't handle backslash separators
  // (what path.join() produces here), so a Windows-built path silently
  // matches zero files instead of erroring.
  apis: [path.join(__dirname, '..', 'routes', '*.{ts,js}').split(path.sep).join('/')],
})
