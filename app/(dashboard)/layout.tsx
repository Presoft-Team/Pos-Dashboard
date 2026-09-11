import DashboardShell from '@/components/dashboard-shell'
import { FilterProvider } from '@/lib/filter-context'
import { getDashboardSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getDashboardSession()

  return (
    <FilterProvider>
      <DashboardShell clientName={session?.name ?? null}>{children}</DashboardShell>
    </FilterProvider>
  )
}
