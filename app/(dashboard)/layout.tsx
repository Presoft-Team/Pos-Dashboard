import DashboardShell from '@/components/dashboard-shell'
import ApiConfigModal from '@/components/api-config-modal'
import { FilterProvider } from '@/lib/filter-context'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <FilterProvider>
      <ApiConfigModal />
      <DashboardShell>{children}</DashboardShell>
    </FilterProvider>
  )
}
