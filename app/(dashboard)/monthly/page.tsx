import MonthlyPage from '@/components/monthly-page'

export const dynamic = 'force-dynamic'

// The classic overview's new home. It used to be the landing page at /,
// which now redirects to the v2 dashboard — see app/(dashboard)/page.tsx.
export default function Page() {
  return <MonthlyPage />
}
