// Protects every route except /login and /api/auth/* — redirects
// unauthenticated requests to /login once DB-based per-client login is in
// use. Edge-compatible: verifies the cookie with jose directly rather than
// lib/auth/session.ts's getDashboardSession() (next/headers-based).
//
// If SESSION_SECRET isn't set, this middleware lets everything through
// unchanged — that's the existing no-DB, single-tenant, no-auth deployment
// mode (see README's "Login" section), so rollout doesn't break it.
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'dashboard_session'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true
  if (pathname.startsWith('/_next/') || pathname === '/favicon.ico') return true
  return false
}

export async function middleware(req: NextRequest) {
  const secret = process.env.SESSION_SECRET
  // No SESSION_SECRET configured => DB-based login isn't rolled out on
  // this deployment yet; behave exactly like before (no auth at all).
  if (!secret) return NextResponse.next()

  const { pathname } = req.nextUrl
  if (isPublic(pathname)) return NextResponse.next()

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret))
      return NextResponse.next()
    } catch {
      // fall through to redirect
    }
  }

  // Clone nextUrl rather than building from req.url: behind a proxy the raw
  // request URL carries the container's internal host, which would redirect
  // the browser somewhere that only exists inside the deployment.
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
