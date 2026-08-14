// Binary passthrough for presoft-api's GET /api/v1/items/:itemCode/image —
// separate from app/api/presoft/[name]/route.ts because that one only ever
// returns JSON (RPC_TO_PATH + a fixed shape); this streams raw image bytes
// with whatever Content-Type presoft-api sniffed, and needs a dynamic path
// segment its dispatcher pattern doesn't support. Same reasoning as every
// other route in this folder: only this server-side handler ever attaches
// PRESOFT_API_KEY, never the browser.
import { NextRequest, NextResponse } from 'next/server'
import { PRESOFT_API_URL, presoftApiHeaders } from '@/lib/presoft-api'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ itemCode: string }> }) {
  const { itemCode } = await params

  let apiRes: Response
  try {
    apiRes = await fetch(`${PRESOFT_API_URL}/api/v1/items/${encodeURIComponent(itemCode)}/image`, {
      headers: presoftApiHeaders(),
    })
  } catch {
    return NextResponse.json({ error: 'Unable to reach presoft-api' }, { status: 502 })
  }

  if (!apiRes.ok) {
    const body = await apiRes.json().catch(() => ({}))
    return NextResponse.json(body, { status: apiRes.status })
  }

  const buffer = await apiRes.arrayBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': apiRes.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
