import { getDashboardSession } from '@/lib/auth/session'
import V2Dashboard from '@/components/v2/dashboard-view'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Sales Dashboard (v2) — Presoft',
}

// Server shell: reads the signed-in client's name for the header, exactly
// as app/(dashboard)/layout.tsx does, then hands off to the client view
// that does the fetching.
export default async function V2DashboardPage() {
  const session = await getDashboardSession()
  return <V2Dashboard clientName={session?.name ?? null} />
}
