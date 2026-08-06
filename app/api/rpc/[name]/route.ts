// Single dispatcher route standing in for every Postgres RPC the app used
// to call via supabase.rpc(name, params) — see PLAN.md §6 and
// lib/db/client.ts. Looks `name` up in the registry, runs the matching
// real SQL Server query, returns the same JSON array shape the Postgres
// function used to (so page components need zero changes beyond swapping
// which client module they import).
import { NextRequest, NextResponse } from 'next/server'
import { rpcRegistry } from '@/lib/db/registry'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const handler = rpcRegistry[name]
  if (!handler) {
    return NextResponse.json({ error: `Unknown RPC: ${name}` }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))

  try {
    const data = await handler(body)
    return NextResponse.json(data)
  } catch (err) {
    console.error(`RPC ${name} failed:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Query failed' },
      { status: 500 }
    )
  }
}
