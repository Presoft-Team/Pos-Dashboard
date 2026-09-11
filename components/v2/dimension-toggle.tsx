'use client'

// The dimension a Top Items card is bucketed by.
//
// These keys are passed straight through to get_sales_by_v2's `sales_by`,
// which autocount-write-service's /api/reports/sales-by understands as
// item / item_group / item_type / item_brand / item_class / item_category.
// All six are real report buckets — unlike get_performance_item_v2, which
// only offers item/group/type.
export type V2ItemDimension =
  | 'item'
  | 'item_group'
  | 'item_type'
  | 'item_brand'
  | 'item_class'
  | 'item_category'

export const ITEM_DIMENSIONS: { key: V2ItemDimension; label: string; title: string; sub: string }[] = [
  { key: 'item',          label: 'Item',     title: 'Top Selling Items', sub: 'Ranked by revenue' },
  { key: 'item_group',    label: 'Group',    title: 'Top Item Groups',   sub: 'Revenue by item group' },
  { key: 'item_type',     label: 'Type',     title: 'Top Item Types',    sub: 'Revenue by item type' },
  { key: 'item_brand',    label: 'Brand',    title: 'Top Brands',        sub: 'Revenue by brand' },
  { key: 'item_category', label: 'Category', title: 'Top Categories',    sub: 'Revenue by category' },
  { key: 'item_class',    label: 'Class',    title: 'Top Classes',       sub: 'Revenue by class' },
]

interface Props {
  value: V2ItemDimension
  onChange: (value: V2ItemDimension) => void
}

export default function DimensionToggle({ value, onChange }: Props) {
  return (
    <div
      className="card-bottom-toggle flex items-center bg-[#f1f3f6] border border-border rounded-lg p-0.5 gap-0.5 mt-3.5 select-none"
      aria-label="Group by dimension"
    >
      {ITEM_DIMENSIONS.map((d) => (
        <button
          key={d.key}
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(d.key) }}
          className={
            'flex-1 min-w-0 border-none bg-transparent text-[10.5px] font-semibold py-1.5 px-0.5 rounded-md leading-tight whitespace-nowrap text-center transition-colors ' +
            (d.key === value
              ? 'bg-white text-blue font-bold shadow-[0_1px_3px_rgba(20,24,31,0.1)]'
              : 'text-sand hover:text-ink hover:bg-white/70')
          }
        >
          {d.label}
        </button>
      ))}
    </div>
  )
}
