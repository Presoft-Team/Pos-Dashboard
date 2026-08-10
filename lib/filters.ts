import { Filters, FilterOptions } from '@/types'

export const DEFAULT_FILTERS: Filters = {
  date_from: '', date_to: '',
  location: '', item: '', sales_agent: '', debtor: '',
  item_group: '', item_type: '', currency: '',
}

export const DEFAULT_OPTIONS: FilterOptions = {
  locations: [], items: [], sales_agents: [], debtors: [],
  item_groups: [], item_types: [], currencies: [],
  date_min: null, date_max: null,
}

// Maps Filters (UI state) onto the common p_* params every rpc_v2 function
// accepts. Individual pages append any function-specific params (p_limit,
// p_group_by, etc.) on top of this.
export function toParams(filters: Filters) {
  return {
    p_date_from:    filters.date_from || null,
    p_date_to:      filters.date_to || null,
    p_location:     filters.location || null,
    p_item:         filters.item || null,
    p_sales_agent:  filters.sales_agent || null,
    p_debtor:       filters.debtor || null,
    p_item_group:   filters.item_group || null,
    p_item_type:    filters.item_type || null,
    p_currency:     filters.currency || null,
  }
}
