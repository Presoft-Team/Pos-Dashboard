# Presoft Dashboard Platform

A Next.js dashboard (revenue, monthly trends, performance breakdowns, purchases, item catalog) over the AutoCount/Presoft SQL Server account book.

This branch is deliberately just **two things**:

1. **The calculations** — the dashboard pages and the revenue/purchase/performance/item logic behind them
2. **The API connection** — one link to AutoCount and its database, through presoft-api

Everything else has been removed. There is **no login** and **no database connection of its own** — no credentials, no SQL driver. Every byte of data comes over HTTP from **presoft-api**, a separate service that owns the real SQL Server connection.

## How it fits together

```
Browser  ──>  This app (Next.js, :3000)  ──>  presoft-api (Express, separate repo, :4000)  ──>  AutoCount SQL Server
```

The browser only ever talks to **this app's own server** — never to presoft-api directly. `app/api/presoft/[name]/route.ts` forwards data requests (`GET /api/presoft/get_kpi_summary_v2`, etc.) to presoft-api's REST endpoints, attaching the shared API key server-side.

That indirection exists for one reason: so the **API key never reaches the browser bundle**.

## Prerequisites

- Node.js 20+
- A running **presoft-api** instance, already connected to a SQL Server account book (via its own `/setup` page), reachable from the machine running this app

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Var | Description |
| --- | --- |
| `PRESOFT_API_URL` | Where presoft-api is running, e.g. `http://localhost:4000` |
| `PRESOFT_API_KEY` | Must match presoft-api's own `API_KEY` exactly — sent as `x-api-key` |

Neither is `NEXT_PUBLIC_`-prefixed on purpose: that prefix inlines a value into the client bundle, defeating the point of keeping the key server-only.

Next reads env files **once at startup** — editing one while `npm run dev` is running has no effect until you fully stop and restart it.

```bash
npm run dev
```

Visit `http://localhost:3000`. There is no login; the dashboard loads straight to data.

## No authentication

This app has no users, sessions, or login page. Anyone who can reach it gets the full dashboard, and presoft-api's own endpoints are gated by a shared API key rather than per-user auth. **Don't expose either service to an untrusted network as-is.**

## How data fetching works

Every dashboard page calls `createClient().rpc(name, params)` (`lib/db/client.ts`) — a shape kept intentionally close to the old Supabase-backed version so page code didn't need to change through the migration. Under the hood:

1. `lib/db/client.ts` fetches this app's own `GET /api/presoft/[name]`
2. `app/api/presoft/[name]/route.ts` maps that RPC name to presoft-api's real REST path, attaches the API key, and forwards the request
3. presoft-api queries SQL Server and returns JSON, which flows back through the same chain

## Checking the connection

`/test` (not linked from nav) is a smoke test for the whole chain:

- **API Connection** reads presoft-api's OpenAPI spec at `/docs.json` and lists every endpoint it advertises. On failure it names the stage — config missing, host unreachable, HTTP error, or "answered but not with JSON" (usually the URL points at the wrong site).
- **Call an endpoint** calls any path on presoft-api and shows status, latency, row count, and raw JSON.

If a probe returns rows, the dashboard pages will work — they use the identical path.

## Project structure

```
app/
  (dashboard)/            main pages — overview, monthly, performance, purchase, item
  (dashboard)/test/       connection smoke test (see above)
  api/presoft/[name]/     server-side proxy to presoft-api (data)
  api/presoft/items/…     binary passthrough for item images
  api/test/connection/    reads presoft-api's /docs.json, reports failure stage
  api/test/probe/         calls one arbitrary presoft-api path
  api/openapi.json/       proxies presoft-api's own spec
  api-docs/               Swagger UI over that spec
lib/
  presoft-api.ts          PRESOFT_API_URL + API key header helper
  db/client.ts            rpc() shim — calls this app's own /api/presoft/*
  filters.ts              Filters -> query params
  filter-context.tsx      shared filter/groupBy state across pages
  currency.ts             per-currency money formatting + chart pivoting
  export.tsx              column specs for the PNG/PDF export modal
components/sidebar.tsx    nav
types/index.ts            row shapes returned by presoft-api
```

## Known loose ends

- No authentication, as above.
- presoft-api's data endpoints are gated by a shared API key, not per-user auth — anyone with the key can call them, so treat the key like a password.
