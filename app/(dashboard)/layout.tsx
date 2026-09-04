import DashboardShell from '@/components/dashboard-shell'
import { FilterProvider } from '@/lib/filter-context'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <FilterProvider>
      <DashboardShell>{children}</DashboardShell>
    </FilterProvider>
  )
}
