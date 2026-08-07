'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Filters, FilterOptions, GroupByMode } from '@/types'
import { DEFAULT_FILTERS, DEFAULT_OPTIONS } from '@/lib/filters'
import { defaultDateRange } from '@/components/date-preset-filter'
import { createClient } from '@/lib/db/client'

interface FilterContextValue {
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  groupBy: GroupByMode
  setGroupBy: React.Dispatch<React.SetStateAction<GroupByMode>>
  options: FilterOptions
  setOptions: React.Dispatch<React.SetStateAction<FilterOptions>>
}

const FilterContext = createContext<FilterContextValue | null>(null)

// Shared filter state for every (dashboard) page — Sales Dashboard, Monthly
// Sales, Performance, and Item all read/write the same `filters`/`groupBy`/
// `options` instead of each keeping its own, so switching pages keeps
// whatever Branch/Item/Sales Agent/Debtor/date-range/currency was set
// instead of resetting to defaults. Lives above <DashboardShell> in the
// (dashboard) layout, so it's created once per session, not per page visit.
export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(() => ({ ...DEFAULT_FILTERS, ...defaultDateRange() }))
  const [groupBy, setGroupBy] = useState<GroupByMode>('item')
  const [options, setOptions] = useState<FilterOptions>(DEFAULT_OPTIONS)

  // Fetched once per session here instead of once per page — the dropdown
  // lists (branches/items/agents/debtors/...) don't depend on which page
  // you're on, so every page reads the same fetch instead of re-requesting it.
  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('get_filter_options_v2').then(({ data, error }) => {
      if (error) console.error('get_filter_options_v2 error:', error.message)
      if (data?.[0]) setOptions(data[0] as FilterOptions)
    })
  }, [])

  return (
    <FilterContext.Provider value={{ filters, setFilters, groupBy, setGroupBy, options, setOptions }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useSharedFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useSharedFilters must be used within a FilterProvider')
  return ctx
}
