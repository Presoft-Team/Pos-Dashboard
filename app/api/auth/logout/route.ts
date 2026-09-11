import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

function clearAndRedirect(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url))
  res.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return res
}

export async function POST(req: Request) {
  return clearAndRedirect(req)
}

export async function GET(req: Request) {
  return clearAndRedirect(req)
}
