'use client'

import SalesDimensionPage from '@/components/sales-dimension-page'

// Sales grouped by the agent named on each document (IV.SalesAgent).
export default function SalesByAgentPage() {
  return (
    <SalesDimensionPage
      dimension="agent"
      title="Sales by Agent"
      subtitle="Revenue per sales agent, with the documents behind it"
      label="Agent"
      optionsKey="agents"
      detailKind="sales_agent"
    />
  )
}
