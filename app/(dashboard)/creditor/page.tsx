'use client'

import PartyCatalog from '@/components/party-catalog'

// Creditor master data — the supplier side of PartyCatalog. The agent field
// is Creditor.PurchaseAgent here, not Debtor.SalesAgent.
export default function CreditorPage() {
  return (
    <PartyCatalog
      title="Creditor"
      subtitle="Browse creditors"
      rpc="get_creditor_catalog_v2"
      agentLabel="Purchase Agent"
      kind="creditor"
    />
  )
}
