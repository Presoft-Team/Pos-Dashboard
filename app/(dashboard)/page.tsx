import { redirect } from 'next/navigation'

// The v2 dashboard is the landing page now. The classic Monthly overview
// that used to live here moved to /monthly (components/monthly-page.tsx);
// every other classic page is unchanged and still reachable from the
// sidebar.
//
// A server-side redirect rather than a rewrite or a middleware rule:
// middleware.ts already owns the signed-out case and must keep owning it.
// Signed out, / never reaches this component at all — the middleware
// bounces it to /login?next=%2F first, and the login page then lands the
// visitor here, which redirects on to /v2. /v2 is inside the same
// protected area, so it is not bounced back and there is no loop.
export const dynamic = 'force-dynamic'

export default function RootPage() {
  redirect('/v2')
}
