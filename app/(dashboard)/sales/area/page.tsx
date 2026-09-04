'use client'

import SalesDimensionPage from '@/components/sales-dimension-page'

// Sales grouped by the area named on each document (IV.Area).
export default function SalesByAreaPage() {
  return (
    <SalesDimensionPage
      dimension="area"
      title="Sales by Area"
      subtitle="Sales per area, with the documents behind it"
      label="Area"
      optionsKey="areas"
    />
  )
}
