// Binary passthrough for the reports service's sales agent photo endpoint —
// mirrors app/api/presoft/items/[itemCode]/image/route.ts. Streams raw
// image bytes from presoft-api with the API key attached server-side.
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/presoft-api'

export async function GET(request: NextRequest, { params }: { params: Promise<{ agentName: string }> }) {
  const { agentName } = await params

  const { res: apiRes, error } = await apiFetch(
    `/api/reports/sales-agents/${encodeURIComponent(agentName)}/image`
  )
  if (error) return error

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
