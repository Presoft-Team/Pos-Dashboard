'use client'

import SalesDimensionPage from '@/components/sales-dimension-page'

// Sales grouped by the location named on each document (IV.Location).
export default function SalesByLocationPage() {
  return (
    <SalesDimensionPage
      dimension="location"
      title="Sales by Location"
      subtitle="Sales per location, with the documents behind it"
      label="Location"
      optionsKey="locations"
    />
  )
}
