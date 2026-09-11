import { PreferencesProvider } from '@/components/v2/preferences'

// Sibling route group to (dashboard), NOT a child of it.
//
// The ported UI brings its own chrome — a sticky Header with the group-by
// select and a SideDrawer — so nesting it inside DashboardShell would give
// every page two headers and two navigations. It still sits behind the same
// login: middleware.ts guards every path except /login and /api/auth/*,
// so /v2 is protected by route, not by layout, and its data goes through
// the same /api/presoft proxy and therefore the same signed-in client's
// getApiConfig().
export const dynamic = 'force-dynamic'

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <div className="v2-scope min-h-full bg-paper text-ink">{children}</div>
    </PreferencesProvider>
  )
}
