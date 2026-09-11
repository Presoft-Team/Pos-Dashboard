import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

// Behind a reverse proxy (Railway, nginx, anything) the request this handler
// sees is the INTERNAL one: req.url reads as http://localhost:8080/... , the
// address inside the container. Redirecting relative to that sends the
// browser to a host that doesn't exist on its side -- the classic
// "logout lands on localhost" bug. The public address arrives in the
// forwarded headers instead, so build the redirect from those, and fall back
// to req.url when running directly with no proxy in front.
function publicOrigin(req: Request): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (!host) return new URL(req.url).origin

  // Proxies may chain and send a comma-separated list; the first entry is
  // the one the browser actually spoke to.
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const proto = forwardedProto || (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https')

  return `${proto}://${host}`
}

function clearAndRedirect(req: Request) {
  const res = NextResponse.redirect(new URL('/login', publicOrigin(req)))
  res.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return res
}

export async function POST(req: Request) {
  return clearAndRedirect(req)
}

export async function GET(req: Request) {
  return clearAndRedirect(req)
}
