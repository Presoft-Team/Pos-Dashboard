'use client'

import PartyCatalog from '@/components/party-catalog'

// Debtor master data — the customer side of PartyCatalog. Catalog/master-data
// browsing, not a sales-performance ranking; the Sales page owns that.
export default function DebtorPage() {
  return (
    <PartyCatalog
      title="Debtor"
      subtitle="Browse debtors"
      rpc="get_debtor_catalog_v2"
      agentLabel="Sales Agent"
      kind="debtor"
    />
  )
}
